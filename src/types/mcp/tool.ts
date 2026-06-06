import { z } from "zod";

import { mcpConfig } from "@/config/mcp.config";
import { assertSafeNavigationUrl } from "@/security/validation";

const { limits } = mcpConfig;

export type ConsoleLog = {
  level?: string;
  message?: string;
  timestamp?: number;
  [key: string]: unknown;
};

const ElementSchema = z.object({
  element: z
    .string()
    .min(1)
    .max(limits.maxElementDescriptionLength)
    .describe(
      "Human-readable element description used to obtain permission to interact with the element",
    ),
  ref: z
    .string()
    .min(1)
    .max(limits.maxRefLength)
    .describe("Exact target element reference from the page snapshot"),
});

export const NavigateTool = z.object({
  name: z.literal("browser_navigate"),
  description: z.literal("Navigate to a URL"),
  arguments: z.object({
    url: z
      .string()
      .min(1)
      .max(limits.maxUrlLength)
      .describe("The URL to navigate to")
      .superRefine((url, ctx) => {
        try {
          assertSafeNavigationUrl(url);
        } catch (error) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: error instanceof Error ? error.message : "Invalid URL",
          });
        }
      }),
  }),
});

export const GoBackTool = z.object({
  name: z.literal("browser_go_back"),
  description: z.literal("Go back to the previous page"),
  arguments: z.object({}),
});

export const GoForwardTool = z.object({
  name: z.literal("browser_go_forward"),
  description: z.literal("Go forward to the next page"),
  arguments: z.object({}),
});

export const WaitTool = z.object({
  name: z.literal("browser_wait"),
  description: z.literal("Wait for a specified time in seconds"),
  arguments: z.object({
    time: z
      .number()
      .positive()
      .max(limits.maxWaitSeconds)
      .describe("The time to wait in seconds"),
  }),
});

export const PressKeyTool = z.object({
  name: z.literal("browser_press_key"),
  description: z.literal("Press a key on the keyboard"),
  arguments: z.object({
    key: z
      .string()
      .min(1)
      .max(limits.maxKeyLength)
      .describe(
        "Name of the key to press or a character to generate, such as `ArrowLeft` or `a`",
      ),
  }),
});

export const SnapshotTool = z.object({
  name: z.literal("browser_snapshot"),
  description: z.literal(
    "Capture accessibility snapshot of the current page. Use this for getting references to elements to interact with.",
  ),
  arguments: z.object({}),
});

export const ClickTool = z.object({
  name: z.literal("browser_click"),
  description: z.literal("Perform click on a web page"),
  arguments: ElementSchema,
});

export const DragTool = z.object({
  name: z.literal("browser_drag"),
  description: z.literal("Perform drag and drop between two elements"),
  arguments: z.object({
    startElement: z.string().min(1).max(limits.maxElementDescriptionLength).describe(
      "Human-readable source element description used to obtain the permission to interact with the element",
    ),
    startRef: z.string().min(1).max(limits.maxRefLength).describe(
      "Exact source element reference from the page snapshot",
    ),
    endElement: z.string().min(1).max(limits.maxElementDescriptionLength).describe(
      "Human-readable target element description used to obtain the permission to interact with the element",
    ),
    endRef: z.string().min(1).max(limits.maxRefLength).describe(
      "Exact target element reference from the page snapshot",
    ),
  }),
});

export const HoverTool = z.object({
  name: z.literal("browser_hover"),
  description: z.literal("Hover over element on page"),
  arguments: ElementSchema,
});

export const TypeTool = z.object({
  name: z.literal("browser_type"),
  description: z.literal("Type text into editable element"),
  arguments: ElementSchema.extend({
    text: z.string().max(limits.maxTextLength).describe("Text to type into the element"),
    submit: z
      .boolean()
      .describe("Whether to submit entered text (press Enter after)"),
  }),
});

export const SelectOptionTool = z.object({
  name: z.literal("browser_select_option"),
  description: z.literal("Select an option in a dropdown"),
  arguments: ElementSchema.extend({
    values: z
      .array(z.string().min(1).max(limits.maxSelectValueLength))
      .min(1)
      .max(limits.maxSelectValues)
      .describe(
        "Array of values to select in the dropdown. This can be a single value or multiple values.",
      ),
  }),
});

export const ScreenshotTool = z.object({
  name: z.literal("browser_screenshot"),
  description: z.literal("Take a screenshot of the current page"),
  arguments: z.object({}),
});

export const GetConsoleLogsTool = z.object({
  name: z.literal("browser_get_console_logs"),
  description: z.literal("Get the console logs from the browser"),
  arguments: z.object({}),
});

export const MCPTool = z.discriminatedUnion("name", [
  NavigateTool,
  GoBackTool,
  GoForwardTool,
  WaitTool,
  PressKeyTool,
  SnapshotTool,
  ClickTool,
  DragTool,
  HoverTool,
  TypeTool,
  SelectOptionTool,
  ScreenshotTool,
  GetConsoleLogsTool,
]);
