# args.ts

An argument parser, similar to yargs and co, but with superiour typing, extensibility, and ease of use.

## Getting started

First, install the package from npm: `npm i args.ts`.
Then, you can get up and running with the following sample:
```js
import { Args, a } from 'args.ts'

const parser = new Args({
  name: 'program-name',
  description: 'program description',
  unknownArgBehaviour: 'throw'
})
    // Short arguments are optional, long arguments are required
    .add(['--long-arg', '-l'], a.String())
    // You can chain calls to type to change how it is parsed
    // and this will reflect in the parsed types, if appropriate
    .add(['--optional'], a.String().optional()) 

const result = await parser.parse('-l "hello world"') 
// { 'long-arg': 'hello world', optional: undefined }
```

args.ts can parse Numbers, Booleans and Strings by default, but you can add your own types with the Custom type, or with a custom argument class:
```js
const myCustomCallback = async (value: string): Promise<ParseResult<number>> => {
    if (value == 'success') {
        return {
            ok: true,
            passedValue: value,
            returnedValue: 69
        }
    }

    return {
        ok: false,
        passedValue: value,
        error: new Error('error whilst parsing') 
    }
}
```
```js
class CustomParseClass extends Argument<number> {
  constructor () {
    super('custom')
  }

  public async parse (value: string): Promise<ParseResult<number}>> {
    if (value == 'success') {
        return {
            ok: true,
            passedValue: value,
            returnedValue: 69
        }
    }

    return {
        ok: false,
        passedValue: value,
        error: new Error('error whilst parsing') 
    }
}
```
These fetchers can both be async, and the parser will await all promises returned.

You can look at the tests for a more expansive set of examples that is guaranteed to be up to date!