export const MESSAGE_RESPONSE_TYPE = "messageResponse" as const;

export type SocketMessageResponse<TResult> = {
  type: typeof MESSAGE_RESPONSE_TYPE;
  payload: {
    requestId: string;
    result?: TResult;
    error?: string;
  };
};

export type SocketMessageRequest<TPayload> = {
  id: string;
  type: string;
  payload: TPayload;
};
