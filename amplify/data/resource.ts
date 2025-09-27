// amplify/data/resource.ts
import { a, defineData, type ClientSchema } from '@aws-amplify/backend';

const schema = a.schema({
  ChatMessage: a.model({
    sessionId: a.string(),             // group messages by session
    userId: a.string(),                // who sent it
    role: a.enum(['user', 'ai']),      // message role
    message: a.string(),               // text
    createdAt: a.datetime().required(), // timestamp
    sources: a.string()
  }).authorization((allow) => [allow.owner(), allow.publicApiKey()]),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'apiKey',
    apiKeyAuthorizationMode: { expiresInDays: 30 },
  },
});
