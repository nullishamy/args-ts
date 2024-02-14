import { ParserOpts } from '../opts'

export interface PackageJson {
  name: string
  description: string
  version: string
}

export function fromPackageJson (json: PackageJson): ParserOpts {
  return {
    programName: json.name,
    programDescription: json.description,
    programVersion: json.version
  }
}
