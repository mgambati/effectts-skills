import { Context, Effect, Layer } from "effect"

export class Endpoint extends Context.Service<Endpoint, { readonly url: string }>()("audit/Endpoint") {}
export class Client extends Context.Service<Client, { readonly url: string }>()("audit/Client") {}

export const EndpointLive = Layer.succeed(Endpoint, { url: "https://example.test" })
export const ClientLive = Layer.effect(Client, Effect.gen(function* () {
  const endpoint = yield* Endpoint
  return { url: endpoint.url }
}))

// Contract: the application entry point must run without caller-supplied services.
export const app = Client.pipe(Effect.map(client => client.url))
export const ready = app.pipe(Effect.provide(ClientLive))
