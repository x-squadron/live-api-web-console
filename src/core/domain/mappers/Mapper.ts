export interface Mapper<To, From> {
  toDomain?(raw: From): To;
  fromDomain?(t: To): From;
}
