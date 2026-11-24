import type { GameSnapshot, PlayerRole, RadioMessage, ZoneId } from './types.ts';

export interface NetworkCallbacks {
  onJoined: (data: { roomCode: string; role: PlayerRole; token: string; snapshot: GameSnapshot }) => void;
  onStateSync: (snapshot: GameSnapshot) => void;
  onRoleUpdated: (role: PlayerRole) => void;
  onRadio: (msg: RadioMessage) => void;
  onError: (message: string) => void;
  onConnectionChange: (connected: boolean) => void;
}

export class PingNineNetwork {
  private ws: WebSocket | null = null;
  private callbacks: NetworkCallbacks | null = null;
  private reconnectTimer: number | null = null;
  private roomCode: string | null = null;
  private token: string | null = null;
  private intentionalClose = false;

  public connect(callbacks: NetworkCallbacks): void {
    this.callbacks = callbacks;
    this.intentionalClose = false;
    this.openSocket();
  }

  private openSocket(): void {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${protocol}//${window.location.host}/ws`;
    const ws = new WebSocket(url);
    this.ws = ws;

    ws.onopen = () => {
      this.callbacks?.onConnectionChange(true);
      const savedRoom = sessionStorage.getItem('ping9_room');
      const savedToken = sessionStorage.getItem('ping9_token');
      if (this.roomCode && this.token) {
        this.send({ type: 'reconnect', roomCode: this.roomCode, token: this.token });
      } else if (savedRoom && savedToken) {
        this.send({ type: 'reconnect', roomCode: savedRoom, token: savedToken });
      }
    };

    ws.onmessage = (evt) => {
      try {
        const data = JSON.parse(String(evt.data));
        if (data.type === 'joined') {
          this.roomCode = data.roomCode;
          this.token = data.token;
          sessionStorage.setItem('ping9_room', data.roomCode);
          sessionStorage.setItem('ping9_token', data.token);
          this.callbacks?.onJoined(data);
        } else if (data.type === 'state_sync') {
          this.callbacks?.onStateSync(data.snapshot);
        } else if (data.type === 'role_updated') {
          this.callbacks?.onRoleUpdated(data.role);
        } else if (data.type === 'radio') {
          this.callbacks?.onRadio(data.message);
        } else if (data.type === 'error') {
          if (String(data.message).includes('expired')) {
            sessionStorage.removeItem('ping9_room');
            sessionStorage.removeItem('ping9_token');
            this.roomCode = null;
            this.token = null;
          }
          this.callbacks?.onError(data.message);
        }
      } catch {
        // Ignore malformed packet
      }
    };

    ws.onclose = () => {
      this.callbacks?.onConnectionChange(false);
      if (!this.intentionalClose) {
        this.reconnectTimer = window.setTimeout(() => this.openSocket(), 1500);
      }
    };
  }

  public send(payload: unknown): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    }
  }

  public createRoom(role: PlayerRole): void {
    sessionStorage.removeItem('ping9_room');
    sessionStorage.removeItem('ping9_token');
    this.roomCode = null;
    this.token = null;
    this.send({ type: 'create_room', role });
  }

  public joinRoom(roomCode: string, role: PlayerRole): void {
    sessionStorage.removeItem('ping9_room');
    sessionStorage.removeItem('ping9_token');
    this.roomCode = null;
    this.token = null;
    this.send({ type: 'join_room', roomCode, role });
  }

  public selectRole(role: PlayerRole): void {
    this.send({ type: 'select_role', role });
  }

  public startGame(): void {
    this.send({ type: 'start_game' });
  }

  public restartGame(): void {
    this.send({ type: 'restart_game' });
  }

  public sendZoneScan(zoneId: ZoneId): void {
    this.send({ type: 'guide_scan', zoneId });
  }

  public sendPing(x: number, z: number, label: string): void {
    this.send({ type: 'guide_ping', x, z, label });
  }

  public sendSafeRoute(toZone: ZoneId): void {
    this.send({ type: 'guide_safe_route', toZone });
  }

  public disconnect(): void {
    this.intentionalClose = true;
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    sessionStorage.removeItem('ping9_room');
    sessionStorage.removeItem('ping9_token');
    this.roomCode = null;
    this.token = null;
    this.ws?.close();
    this.ws = null;
  }
}
