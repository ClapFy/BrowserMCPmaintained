export type SocketMessageDefinition = {
  payload: unknown;
  result: unknown;
};

export type MessageType<M extends Record<string, SocketMessageDefinition>> =
  keyof M & string;

export type MessagePayload<
  M extends Record<string, SocketMessageDefinition>,
  T extends MessageType<M>,
> = M[T]["payload"];

export type MessageResult<
  M extends Record<string, SocketMessageDefinition>,
  T extends MessageType<M>,
> = M[T]["result"];
