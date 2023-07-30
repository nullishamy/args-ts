/* eslint-disable @typescript-eslint/quotes */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { a, Args, Command, ParserOpts } from '../src'

describe('Integrations', () => {
  it('can parse a vsc application', async () => {
    // Emulates basic `git` features
    class Clone extends Command {
      constructor (opts: ParserOpts) {
        super({
          description: 'Clone a repository into a new directory',
          parserOpts: opts
        })
      }

      args = (parser: Args<unknown>) => parser
        .positional('<repo>', a.string().matches(/http(s).*/))
        .positional('<target>', a.string().optional())

      run = this.runner(async args => {
        if (!args.target) {
          args.target = process.cwd()
        }
        return `Cloning ${args.repo} into ${args.target}`
      })
    }

    class Add extends Command {
      constructor (opts: ParserOpts) {
        super({
          description: 'Add file contents to the index',
          parserOpts: opts
        })
      }

      args = (parser: Args<unknown>) => parser
        .arg(['--patch', '-p'], a.bool())
        .arg(['--force', '-f'], a.bool())
        .arg(['--chmod'], a.string().matches(/(\+|-)x/).optional())
        .positional('<paths>', a.string().array())

      run = this.runner(async args => {
        return `Adding "${args.paths.join(', ')}" to the index (patch: ${args.patch}) (chmod: ${args.chmod})`
      })
    }

    class Commit extends Command {
      constructor (opts: ParserOpts) {
        super({
          description: 'Record changes to the repository',
          parserOpts: opts
        })
      }

      args = (parser: Args<unknown>) => parser
        .arg(['--message', '-m'], a.string().nonEmpty().array())
        .positional('<paths>', a.string().array())

      run = this.runner(async args => {
        return `Committing "${args.paths.join(', ')}" to the repository (message: ${args.message})`
      })
    }

    const opts: ParserOpts = {
      programName: 'git',
      programDescription: 'VCS',
      excessArgBehaviour: 'throw',
      unknownArgBehaviour: 'throw'
    }

    const parser = new Args(opts)
      .arg(['--version', '-v'], a.bool())
      .arg(['--help', '-h'], a.bool())
      .command(['clone'], new Clone(opts))
      .command(['add'], new Add(opts))
      .command(['commit'], new Commit(opts))
      .header(`
Git is a fast, scalable, distributed revision control system with an unusually rich command set that provides both
See gittutorial(7) to get started, then see giteveryday(7) for a useful minimum set of commands. The Git User’s
Manual[1] has a more in-depth introduction.

After you mastered the basic concepts, you can come back to this page to learn what commands Git offers. You can
learn more about individual Git commands with "git help command". gitcli(7) manual page gives you an overview of
the command-line command syntax.

A formatted and hyperlinked copy of the latest Git documentation can be viewed at
https://git.github.io/htmldocs/git.html or https://git-scm.com/docs.`)
      .footer(`
Git was started by Linus Torvalds, and is currently maintained by Junio C Hamano. Numerous contributions have come
from the Git mailing list <git@vger.kernel.org[6]>. http://www.openhub.net/p/git/contributors/summary gives you a
more complete list of contributors.

If you have a clone of git.git itself, the output of git-shortlog(1) and git-blame(1) can show you the authors for
specific parts of the project. 
      `)

    const validation = parser.validate()
    if (!validation.ok) {
      console.error(`Schema validation failure\n${validation.err.stack}`)
    }

    async function runCase (input: string): Promise<unknown> {
      const result = await parser.parse(input)
      if (!result.ok) {
        console.error(`Failed to parse commands\n${result.err.stack}`)
      } else if (result.val.mode === 'command') {
        return await result.val.command.run(result.val.parsedArgs)
      } else if (result.val.mode === 'args') {
        // Default runner
        console.log('Default runner', result.val.args)
      }
    }

    console.log(parser.help())

    expect(await runCase('add path1 path2 path3')).toMatchInlineSnapshot(`"Adding "path1, path2, path3" to the index (patch: false) (chmod: undefined)"`)
    expect(await runCase('add path1 path2 path3 -p')).toMatchInlineSnapshot(`"Adding "path1, path2, path3" to the index (patch: true) (chmod: undefined)"`)
    expect(await runCase('add path1 path2 path3 -p --chmod "-x"')).toMatchInlineSnapshot(`"Adding "path1, path2, path3" to the index (patch: true) (chmod: -x)"`)
    expect(await runCase('clone https://github.com/nullishamy/args-ts args-ts')).toMatchInlineSnapshot(`"Cloning https://github.com/nullishamy/args-ts into args-ts"`)
    expect(await runCase('commit path4 path5 path6 -m "My epic commit message"')).toMatchInlineSnapshot(`"Committing "path4, path5, path6" to the repository (message: My epic commit message)"`)
  })
})
