interface ResultOk<T> {
  ok: true
  val: T
}

interface ResultErr<T> {
  ok: false
  err: T
}

export type Result<T, E = unknown> = ResultOk<T> | ResultErr<E>

export function Ok<T> (val: T): ResultOk<T> {
  const object = {
    ok: true,
    val
  } as const

  const stringify = (): string => `Ok(${JSON.stringify(val, undefined, 2)})`

  Object.defineProperty(object, 'toString', {
    value: stringify
  })

  return object
}

export function Err<E extends Error> (err: E): ResultErr<E> {
  const object = {
    ok: false,
    err
  } as const

  const stringify = (): string => `Err(${err.constructor.name} { ${err.message} })`

  Object.defineProperty(object, 'toString', {
    value: stringify
  })

  return object
}
