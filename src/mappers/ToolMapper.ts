import { Usecase, GenerateTaskListForInterval } from "@core";
import { FunctionDeclaration, Type } from "@google/genai";

export class ToolMapper {
  static fromUsecase(usecase: Usecase<any, any, any>): FunctionDeclaration {
    console.log("[ToolMapper] fromUsecase", usecase);
    if (usecase instanceof GenerateTaskListForInterval) {
      return {
        name: usecase.constructor.name.toUpperCase(),
        description: "Generate a task list for a given interval",
        parameters: {
          type: Type.OBJECT,
          properties: {
            interval: {
              type: Type.OBJECT,
              properties: {
                start: {
                  type: Type.STRING,
                  // format: "date-time",
                  description:
                    "The start date and time of the interval in an ISO date time format",
                },
                end: {
                  type: Type.STRING,
                  // format: "date-time",
                  description:
                    "The end date and time of the interval in an ISO date time format",
                },
                label: {
                  type: Type.STRING,
                },
              },
              required: ["start", "end"],
            },
          },
          required: ["interval"],
        },
        // response: {
        //   type: Type.OBJECT,
        //   properties: {
        //     tasks: {
        //       type: Type.ARRAY,
        //     },
        //   },
        // },
      };
    }

    throw new Error(`Unsupported usecase: ${usecase.constructor.name}`);
  }
}
