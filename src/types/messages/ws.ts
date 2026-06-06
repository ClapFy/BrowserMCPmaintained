type EmptyPayload = Record<string, never>;

type ConsoleLog = {
  level?: string;
  message?: string;
  timestamp?: number;
  [key: string]: unknown;
};

type ElementInteractionPayload = {
  element: string;
  ref: string;
};

type DragPayload = {
  startElement: string;
  startRef: string;
  endElement: string;
  endRef: string;
};

type TypePayload = ElementInteractionPayload & {
  text: string;
  submit: boolean;
};

type SelectOptionPayload = ElementInteractionPayload & {
  values: string[];
};

/** WebSocket message types exchanged with the Browser MCP Chrome extension. */
export type SocketMessageMap = {
  getUrl: { payload: undefined; result: string };
  getTitle: { payload: undefined; result: string };
  browser_snapshot: { payload: EmptyPayload; result: string };
  browser_navigate: { payload: { url: string }; result: void };
  browser_go_back: { payload: EmptyPayload; result: void };
  browser_go_forward: { payload: EmptyPayload; result: void };
  browser_wait: { payload: { time: number }; result: void };
  browser_press_key: { payload: { key: string }; result: void };
  browser_click: { payload: ElementInteractionPayload; result: void };
  browser_drag: { payload: DragPayload; result: void };
  browser_hover: { payload: ElementInteractionPayload; result: void };
  browser_type: { payload: TypePayload; result: void };
  browser_select_option: { payload: SelectOptionPayload; result: void };
  browser_screenshot: { payload: EmptyPayload; result: string };
  browser_get_console_logs: { payload: EmptyPayload; result: ConsoleLog[] };
};
