import { defineSchema, defineTable } from 'convex/server';
import { Infer, v } from 'convex/values';
import { tableHelper } from './lib/utils.js';
import { Position, Pose } from './lib/physics.js';

// ts is milliseconds in game time
const ts = v.number();
export type GameTs = Infer<typeof ts>;

export const Agents = tableHelper('agents', {
  name: v.string(),
  nextActionTs: v.number(), // When to run next action
});

export const Memories = tableHelper('memories', {
  agentId: v.id('agents'),
  description: v.string(),
  embeddingId: v.id('embeddings'),
  importance: v.number(),
  ts,
  data: v.union(
    // Useful for seed memories, high level goals
    v.object({
      type: v.literal('identity'),
    }),
    // Setting up dynamics between agents
    v.object({
      type: v.literal('relationship'),
      agentId: v.id('agents'),
    }),
    // Per-agent summary of recent observations
    // Can start out all the same, but could be dependent on personality
    v.object({
      type: v.literal('conversation'),
      coversationId: v.id('conversations'),
    }),
    v.object({
      type: v.literal('plan'),
    }),

    // Exercises left to the reader:

    // v.object({
    //   type: v.literal('reflection'),
    //   relatedMemoryIds: v.array(v.id('memories')),
    // }),
    // v.object({
    //   type: v.literal('observation'),
    //   object: v.string(),
    //   pose: Pose,
    // }),
    // Seemed too noisey for every message for every party, but maybe?
    // v.object({
    //   type: v.literal('message'),
    //   messageId: v.id('messages'),
    //   relatedMemoryIds: v.optional(v.array(v.id('memories'))),
    // }),
    // Could be a way to have the agent reflect and change identities
  ),
});
export type Memory = Infer<typeof Memories.doc>;
export type MemoryType = Memory['data']['type'];
export type MemoryOfType<T extends MemoryType> = Omit<Memory, 'data'> & {
  data: Extract<Memory['data'], { type: T }>;
};

// Journal documents are append-only, and define an agent's state.
export const Journal = tableHelper('journal', {
  ts,
  // Could be extended to non-agent actors
  actorId: v.id('agents'),
  // emojiSummary: v.string(),
  data: v.union(
    v.object({
      type: v.literal('talking'),
      // If they are speaking to a person in particular.
      // If it's empty, it's just talking out loud.
      audience: v.array(v.id('agents')),
      content: v.string(),
      // Refers to the first message in the conversation.
      conversationId: v.id('journal'),
      relatedMemories: v.array(v.id('memories')),
    }),
    v.object({
      type: v.literal('stopped'),
      reason: v.union(v.literal('interrupted'), v.literal('finished')),
      pose: Pose,
    }),
    v.object({
      type: v.literal('walking'),
      route: v.array(Position),
      targetEndTs: v.number(),
    }),
    // When we run the agent loop.
    v.object({
      type: v.literal('planning'),
    }),
    // In case we don't do anything, confirm we're done planning.
    v.object({
      type: v.literal('continuing'),
    }),

    // Exercises left to the reader:

    // v.object({
    //   type: v.literal('thinking'),
    // }),
    // v.object({
    //   type: v.literal('activity'),
    //   description: v.string(),
    // 	// objects: v.array(v.object({ id: v.id('objects'), action: v.string() })),
    //   pose: Pose,
    // }),
  ),
});
export type Entry = Infer<typeof Journal.doc>;
export type EntryType = Entry['data']['type'];
export type EntryOfType<T extends EntryType> = Omit<Entry, 'data'> & {
  data: Extract<Entry['data'], { type: T }>;
};

export default defineSchema({
  agents: Agents.table,
  journal: Journal.table
    .index('by_actorId_type_ts', ['actorId', 'data.type', 'ts'])
    .index('by_conversation', ['data.conversationId', 'ts']),

  memories: Memories.table
    .index('by_embeddingId', ['embeddingId', 'ts'])
    .index('by_agentId_type_ts', ['agentId', 'data.type', 'ts']),

  // To track recent accesses
  memoryAccesses: defineTable({
    memoryId: v.id('memories'),
    ts,
  }).index('by_memoryId', ['memoryId']),

  embeddings: defineTable({
    agentId: v.id('agents'),
    embedding: v.array(v.number()),
  }).vectorIndex('embedding', {
    vectorField: 'embedding',
    filterFields: ['agentId'],
    dimension: 1536,
  }),

  // To avoid recomputing embeddings
  embeddingCache: defineTable({
    text: v.string(),
    embeddingId: v.id('embeddings'),
  }).index('by_text', ['text']),
});
