// --- Data Types ---
export type Annotation = string;

export interface Commentable {
  description: string;
  leadingComments?: string;
  trailingComments?: string;
  leadingDetachedComments?: string[];
}

export interface Field extends Commentable {
  name: string;
  type: string;
  tag: number;
  annotations?: Annotation[];
  isRepeated?: boolean;
  isMap?: boolean;
  keyType?: string;
  valueType?: string;
}

export interface Extension extends Commentable {
  name: string;
  type: string;
  tag: number;
  extendee: string;
  isRepeated?: boolean;
}

export interface Message extends Commentable {
  name: string;
  fields: Field[];
  isMapEntry?: boolean;
  nestedMessages?: Message[];
  nestedEnums?: Enum[];
}

export interface EnumValue extends Commentable {
  name: string;
  value: number;
}

export interface Enum extends Commentable {
  name: string;
  values: EnumValue[];
}

export interface Rpc extends Commentable {
  name:string;
  request: string;
  response: string;
  isServerStream?: boolean;
  isClientStream?: boolean;
  isBidi?: boolean;
}

export interface Service extends Commentable {
  name: string;
  rpcs: Rpc[];
}

export interface ProtoFile extends Commentable {
  fileName: string;
  package: string;
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

// --- Config ---
export interface Config {
  title: string;
  descriptor_files: string[];
  front_page_markdown_file?: string;
  bottom_of_front_page_markdown_file?: string;
}
