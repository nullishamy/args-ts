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
  return {
    ok: true,
    val
  }
}

export function Err<E> (err: E): ResultErr<E> {
  return {
    ok: false,
    err
  }
}
