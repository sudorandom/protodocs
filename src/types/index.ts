// --- Data Types ---
export type Annotation = string;

export interface Field {
  name: string;
  type: string;
  tag: number;
  description: string;
  annotations?: Annotation[];
  isRepeated?: boolean;
  isMap?: boolean;
  keyType?: string;
  valueType?: string;
}

export interface Extension {
  name: string;
  type: string;
  tag: number;
  description: string;
  extendee: string;
  isRepeated?: boolean;
}

export interface Message {
  name: string;
  description: string;
  fields: Field[];
  isMapEntry?: boolean;
  nestedMessages?: Message[];
  nestedEnums?: Enum[];
}

export interface EnumValue {
  name: string;
  value: number;
  description: string;
}

export interface Enum {
  name: string;
  description: string;
  values: EnumValue[];
}

export interface Rpc {
  name:string;
  request: string;
  response: string;
  description: string;
  isServerStream?: boolean;
  isClientStream?: boolean;
  isBidi?: boolean;
}

export interface Service {
  name: string;
  description: string;
  rpcs: Rpc[];
}

export interface ProtoFile {
  fileName: string;
  package: string;
  description: string;
  messages: Message[];
  services: Service[];
  enums: Enum[];
  extensions: Extension[];
  edition?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  options?: Record<string, any>;
}

export interface ProtoPackage {
    name: string;
    files: ProtoFile[];
}
