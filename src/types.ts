// for some reason eslint was parsing the type inside of the function params as a variable
export interface Codec {
  // eslint-disable-next-line
  encode: (str: string | undefined) => string;
  // eslint-disable-next-line
  decode: (str: string | undefined) => string;
}

export interface Config {
  prefix?: string;
  codec: Codec;
  config: string;
  bundle: string;
  worker: string;
  client: string;
  codecs: string;
}

export interface ConfigWithStringCodec {
  prefix?: string;
  codec: string;
  config: string;
  bundle: string;
  worker: string;
  client: string;
  codecs: string;
}