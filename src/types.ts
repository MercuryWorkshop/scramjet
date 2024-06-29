// for some reason eslint was parsing the type inside of the function params as a variable
export interface IScramJetCodec {
  // eslint-disable-next-line
  encode: (str: string | undefined) => string;
  // eslint-disable-next-line
  decode: (str: string | undefined) => string;
}

export interface IScramJetConfig {
  prefix?: string;
  codec: IScramJetCodec;
  config: string;
  bundle: string;
  worker: string;
  client: string;
  codecs: string;
}

export interface IScramJetConfigWithStringCodec {
  prefix?: string;
  codec: string;
  config: string;
  bundle: string;
  worker: string;
  client: string;
  codecs: string;
}