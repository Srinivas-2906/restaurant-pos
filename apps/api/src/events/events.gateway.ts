import { WebSocketGateway, WebSocketServer, SubscribeMessage, OnGatewayConnection } from "@nestjs/websockets";
import { Server, Socket } from "socket.io";

@WebSocketGateway({ cors: { origin: "*" }, namespace: "/events" })
export class EventsGateway implements OnGatewayConnection {
  @WebSocketServer()
  server!: Server;

  handleConnection(client: Socket) {
    client.emit("connected", { clientId: client.id });
  }

  @SubscribeMessage("join")
  handleJoin(client: Socket, payload: { channel: string }) {
    client.join(payload.channel);
    return { joined: payload.channel };
  }

  @SubscribeMessage("leave")
  handleLeave(client: Socket, payload: { channel: string }) {
    client.leave(payload.channel);
    return { left: payload.channel };
  }

  emitOrderUpdate(outletId: string, data: unknown) {
    this.server.to(`outlet:${outletId}:orders`).emit("order:update", data);
  }

  emitKOTUpdate(stationId: string, data: unknown) {
    this.server.to(`station:${stationId}:kots`).emit("kot:update", data);
  }

  emitTerminalSync(terminalId: string, data: unknown) {
    this.server.to(`terminal:${terminalId}:sync`).emit("terminal:sync", data);
  }
}
