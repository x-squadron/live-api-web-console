export interface Usecase<InputPort, OutputPort, T> {
  execute(inputs?: InputPort, outputs?: OutputPort): Promise<T>;
}

export type ExtractUsecasePorts<T> =
  T extends Usecase<infer InputPort, infer OutputPort, any>
    ? { inputs: InputPort; outputs?: OutputPort }
    : never;
