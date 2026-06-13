import * as mediasoup from "mediasoup";
import type { types as mediasoupTypes } from "mediasoup";
import { env } from "../config/env.js";

type TransportDirection = "send" | "recv";

interface PeerState {
  participantId: string;
  transports: Map<string, mediasoupTypes.WebRtcTransport>;
  producers: Map<string, mediasoupTypes.Producer>;
  consumers: Map<string, mediasoupTypes.Consumer>;
}

interface RoomState {
  sessionId: string;
  router: mediasoupTypes.Router;
  peers: Map<string, PeerState>;
}

const mediaCodecs: mediasoupTypes.RtpCodecCapability[] = [
  {
    kind: "audio",
    mimeType: "audio/opus",
    preferredPayloadType: 100,
    clockRate: 48000,
    channels: 2,
  },
  {
    kind: "video",
    mimeType: "video/VP8",
    preferredPayloadType: 101,
    clockRate: 90000,
    parameters: {
      "x-google-start-bitrate": 800,
    },
  },
];

class MediaService {
  private worker: mediasoupTypes.Worker | null = null;
  private rooms = new Map<string, RoomState>();

  async getWorker() {
    if (this.worker) return this.worker;

    this.worker = await mediasoup.createWorker({
      rtcMinPort: env.MEDIASOUP_MIN_PORT,
      rtcMaxPort: env.MEDIASOUP_MAX_PORT,
      logLevel: "warn",
    });

    this.worker.on("died", () => {
      console.error("[mediasoup] worker died. Exiting process.");
      process.exit(1);
    });

    console.log(
      `[mediasoup] worker started, RTC ports ${env.MEDIASOUP_MIN_PORT}-${env.MEDIASOUP_MAX_PORT}`
    );

    return this.worker;
  }

  async getRoom(sessionId: string) {
    const existingRoom = this.rooms.get(sessionId);
    if (existingRoom) return existingRoom;

    const worker = await this.getWorker();
    const router = await worker.createRouter({ mediaCodecs });

    const room: RoomState = {
      sessionId,
      router,
      peers: new Map(),
    };

    this.rooms.set(sessionId, room);

    console.log(`[mediasoup] router created for session ${sessionId}`);

    return room;
  }

  async getRouterRtpCapabilities(sessionId: string) {
    const room = await this.getRoom(sessionId);
    return room.router.rtpCapabilities;
  }

  private getOrCreatePeer(room: RoomState, participantId: string) {
    const existingPeer = room.peers.get(participantId);
    if (existingPeer) return existingPeer;

    const peer: PeerState = {
      participantId,
      transports: new Map(),
      producers: new Map(),
      consumers: new Map(),
    };

    room.peers.set(participantId, peer);
    return peer;
  }

  async createWebRtcTransport(input: {
    sessionId: string;
    participantId: string;
    direction: TransportDirection;
  }) {
    const room = await this.getRoom(input.sessionId);
    const peer = this.getOrCreatePeer(room, input.participantId);

    const transport = await room.router.createWebRtcTransport({
      listenInfos: [
        {
          protocol: "udp",
          ip: env.MEDIASOUP_LISTEN_IP,
          announcedAddress: env.MEDIASOUP_ANNOUNCED_IP,
          portRange: {
            min: env.MEDIASOUP_MIN_PORT,
            max: env.MEDIASOUP_MAX_PORT,
          },
        },
        {
          protocol: "tcp",
          ip: env.MEDIASOUP_LISTEN_IP,
          announcedAddress: env.MEDIASOUP_ANNOUNCED_IP,
          portRange: {
            min: env.MEDIASOUP_MIN_PORT,
            max: env.MEDIASOUP_MAX_PORT,
          },
        },
      ],
      enableUdp: true,
      enableTcp: true,
      preferUdp: true,
      initialAvailableOutgoingBitrate: 1_000_000,
      appData: {
        direction: input.direction,
        participantId: input.participantId,
      },
    } as mediasoupTypes.WebRtcTransportOptions);

    peer.transports.set(transport.id, transport);

    transport.on("dtlsstatechange", (state) => {
      if (state === "closed") {
        transport.close();
      }
    });

    transport.observer.on("close", () => {
      peer.transports.delete(transport.id);
    });

    console.log(
      `[mediasoup] ${input.direction} transport ${transport.id} created for participant ${input.participantId}`
    );

    return {
      id: transport.id,
      iceParameters: transport.iceParameters,
      iceCandidates: transport.iceCandidates,
      dtlsParameters: transport.dtlsParameters,
      sctpParameters: transport.sctpParameters,
    };
  }

  async connectTransport(input: {
    sessionId: string;
    participantId: string;
    transportId: string;
    dtlsParameters: mediasoupTypes.DtlsParameters;
  }) {
    const room = await this.getRoom(input.sessionId);
    const peer = room.peers.get(input.participantId);
    const transport = peer?.transports.get(input.transportId);

    if (!transport) {
      throw new Error("Transport not found");
    }

    await transport.connect({
      dtlsParameters: input.dtlsParameters,
    });

    console.log(`[mediasoup] transport connected ${input.transportId}`);
  }

  async produce(input: {
    sessionId: string;
    participantId: string;
    transportId: string;
    kind: mediasoupTypes.MediaKind;
    rtpParameters: mediasoupTypes.RtpParameters;
    appData?: Record<string, unknown>;
  }) {
    const room = await this.getRoom(input.sessionId);
    const peer = room.peers.get(input.participantId);
    const transport = peer?.transports.get(input.transportId);

    if (!peer || !transport) {
      throw new Error("Send transport not found");
    }

    const producer = await transport.produce({
      kind: input.kind,
      rtpParameters: input.rtpParameters,
      appData: {
        participantId: input.participantId,
        ...(input.appData ?? {}),
      },
    });

    peer.producers.set(producer.id, producer);

    producer.observer.on("close", () => {
      peer.producers.delete(producer.id);
    });

    console.log(
      `[mediasoup] producer ${producer.id} created kind=${producer.kind} participant=${input.participantId}`
    );

    return producer;
  }

  listRemoteProducers(input: {
    sessionId: string;
    participantId: string;
  }) {
    const room = this.rooms.get(input.sessionId);
    if (!room) return [];

    const producers: Array<{
      producerId: string;
      participantId: string;
      kind: mediasoupTypes.MediaKind;
    }> = [];

    for (const [participantId, peer] of room.peers.entries()) {
      if (participantId === input.participantId) continue;

      for (const producer of peer.producers.values()) {
        producers.push({
          producerId: producer.id,
          participantId,
          kind: producer.kind,
        });
      }
    }

    return producers;
  }

  async consume(input: {
    sessionId: string;
    participantId: string;
    producerId: string;
    rtpCapabilities: mediasoupTypes.RtpCapabilities;
  }) {
    const room = await this.getRoom(input.sessionId);
    const peer = room.peers.get(input.participantId);

    if (!peer) {
      throw new Error("Peer not found");
    }

    const recvTransport = [...peer.transports.values()].find(
      (transport) =>
        !transport.closed && transport.appData.direction === "recv"
    );

    if (!recvTransport) {
      throw new Error("Receive transport not found");
    }

    if (
      !room.router.canConsume({
        producerId: input.producerId,
        rtpCapabilities: input.rtpCapabilities,
      })
    ) {
      throw new Error("Cannot consume this producer");
    }

    const consumer = await recvTransport.consume({
      producerId: input.producerId,
      rtpCapabilities: input.rtpCapabilities,
      paused: false,
    });

    peer.consumers.set(consumer.id, consumer);

    consumer.observer.on("close", () => {
      peer.consumers.delete(consumer.id);
    });

    console.log(
      `[mediasoup] consumer ${consumer.id} created for producer ${input.producerId}`
    );

    return consumer;
  }

  async resumeConsumer(input: {
    sessionId: string;
    participantId: string;
    consumerId: string;
  }) {
    const room = await this.getRoom(input.sessionId);
    const peer = room.peers.get(input.participantId);
    const consumer = peer?.consumers.get(input.consumerId);

    if (!consumer || consumer.closed) {
      console.warn(
        `[mediasoup] resume skipped; consumer already closed ${input.consumerId}`
      );
      return;
    }

    try {
      await consumer.resume();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      if (
        message.includes("Channel request handler") ||
        message.includes("not found") ||
        message.includes("closed")
      ) {
        console.warn(
          `[mediasoup] resume ignored for stale consumer ${input.consumerId}: ${message}`
        );
        return;
      }

      throw error;
    }
  }

  listSessionProducers(sessionId: string) {
    const room = this.rooms.get(sessionId);

    if (!room) return [];

    const producers: Array<{
      producerId: string;
      participantId: string;
      kind: mediasoupTypes.MediaKind;
    }> = [];

    for (const [participantId, peer] of room.peers.entries()) {
      for (const producer of peer.producers.values()) {
        producers.push({
          producerId: producer.id,
          participantId,
          kind: producer.kind,
        });
      }
    }

    return producers;
  }

  async createServerSideRtpConsumer(input: {
    sessionId: string;
    producerId: string;
    rtpPort: number;
    plainTransportPort: number;
  }) {
    const room = this.rooms.get(input.sessionId);

    if (!room) {
      throw new Error("Media room not found for server-side recording");
    }

    const producerInfo = this
      .listSessionProducers(input.sessionId)
      .find((producer) => producer.producerId === input.producerId);

    if (!producerInfo) {
      throw new Error("Producer not found for server-side recording");
    }

    const plainTransport = await room.router.createPlainTransport({
      listenInfo: {
        protocol: "udp",
        ip: "127.0.0.1",
        port: input.plainTransportPort,
      },
      rtcpMux: true,
      comedia: false,
    } as mediasoupTypes.PlainTransportOptions);

    await plainTransport.connect({
      ip: "127.0.0.1",
      port: input.rtpPort,
    });

    const consumer = await plainTransport.consume({
      producerId: input.producerId,
      rtpCapabilities: room.router.rtpCapabilities,
      paused: true,
    });

    return {
      producerId: input.producerId,
      participantId: producerInfo.participantId,
      kind: consumer.kind,
      rtpParameters: consumer.rtpParameters,
      async resume() {
        if (!consumer.closed) {
          await consumer.resume();
        }
      },
      close() {
        if (!consumer.closed) {
          consumer.close();
        }

        if (!plainTransport.closed) {
          plainTransport.close();
        }
      },
    };
  }

  closeProducer(input: {
    sessionId: string;
    participantId: string;
    producerId: string;
  }) {
    const room = this.rooms.get(input.sessionId);
    const peer = room?.peers.get(input.participantId);
    const producer = peer?.producers.get(input.producerId);

    if (producer && !producer.closed) {
      producer.close();
    }

    peer?.producers.delete(input.producerId);
  }

  closePeer(sessionId: string, participantId: string) {
    const room = this.rooms.get(sessionId);
    const peer = room?.peers.get(participantId);

    const closedProducers: Array<{
      producerId: string;
      participantId: string;
      kind: mediasoupTypes.MediaKind;
    }> = [];

    if (!room || !peer) return closedProducers;

    for (const producer of peer.producers.values()) {
      closedProducers.push({
        producerId: producer.id,
        participantId,
        kind: producer.kind,
      });
    }

    for (const consumer of peer.consumers.values()) {
      if (!consumer.closed) consumer.close();
    }

    for (const producer of peer.producers.values()) {
      if (!producer.closed) producer.close();
    }

    for (const transport of peer.transports.values()) {
      if (!transport.closed) transport.close();
    }

    room.peers.delete(participantId);

    console.log(`[mediasoup] peer media closed ${participantId}`);

    return closedProducers;
  }

  closeRoom(sessionId: string) {
    const room = this.rooms.get(sessionId);
    if (!room) return;

    for (const participantId of room.peers.keys()) {
      this.closePeer(sessionId, participantId);
    }

    this.rooms.delete(sessionId);

    console.log(`[mediasoup] room closed ${sessionId}`);
  }
}

export const mediaService = new MediaService();