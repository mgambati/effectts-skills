import { Schema } from "effect"

export interface StoredUser {
  readonly id: string
  readonly givenName: string
  readonly familyName: string
  readonly passwordHash: string
}

export const PublicUser = Schema.Struct({ id: Schema.String, displayName: Schema.String })

// Contract: expose exactly id and a combined displayName, never storage credentials.
export const toPublicUser = (row: StoredUser): typeof PublicUser.Type => ({
  id: row.id,
  displayName: `${row.givenName} ${row.familyName}`,
})
