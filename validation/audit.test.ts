import { expect, it } from "vitest"
import { Effect, Layer, Schema } from "effect"
import { deliver } from "./audit-cases/delivery"
import { app, ClientLive, EndpointLive } from "./audit-cases/wiring"
import { PublicUser, toPublicUser } from "./audit-cases/profile"
import { total } from "./audit-cases/total"

const deliveryContract = async (operation: typeof deliver) => {
  const records: string[] = []
  const result = await Effect.runPromise(operation(() => { records.push("delivered") }))
  expect({ result, records }).toEqual({ result: "acknowledged", records: ["delivered"] })
}

it("delivery contract detects the missing operation and accepts sequencing it", async () => {
  await expect(deliveryContract(deliver)).rejects.toThrow("expected")
  await deliveryContract(record => Effect.gen(function* () {
    yield* Effect.sync(record)
    return "acknowledged" as const
  }))
})

it("providing the required endpoint makes the application runnable", async () => {
  const live = ClientLive.pipe(Layer.provide(EndpointLive))
  expect(await Effect.runPromise(app.pipe(Effect.provide(live)))).toBe("https://example.test")
})

it("the mapper satisfies the independent public contract and excludes private fields", async () => {
  const row = { id: "user-1", givenName: "Ada", familyName: "Lovelace", passwordHash: "private" }
  const mapped = toPublicUser(row)
  expect(mapped).toEqual({ id: "user-1", displayName: "Ada Lovelace" })
  const jsonSchema = Schema.fromJsonString(PublicUser)
  const encoded = await Effect.runPromise(Schema.encodeEffect(jsonSchema)(mapped))
  expect(JSON.parse(encoded)).toEqual({ id: "user-1", displayName: "Ada Lovelace" })
  expect(await Effect.runPromise(Schema.decodeUnknownEffect(jsonSchema)(encoded))).toEqual(mapped)
  expect(row.passwordHash).toBe("private")
})

it("the composed Effect stays lazy and reads once on each run", async () => {
  let reads = 0
  const operation = total(Effect.sync(() => { reads++; return [2, 3, -1] }))
  expect(reads).toBe(0)
  expect(await Effect.runPromise(operation)).toBe(4)
  expect(reads).toBe(1)
  expect(await Effect.runPromise(operation)).toBe(4)
  expect(reads).toBe(2)
  expect(await Effect.runPromise(total(Effect.succeed([])))).toBe(0)
})
