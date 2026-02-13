import { Type, Static } from '@sinclair/typebox';

export const GameLaunchSchema = Type.Object({
  user: Type.String({ minLength: 1, maxLength: 128 }),
  token: Type.String({ minLength: 1, maxLength: 255 }),
  currency: Type.String({ minLength: 3, maxLength: 3 }),
  operator_id: Type.Union([Type.String(), Type.Number()]),
  game_code: Type.String({ minLength: 1 }),
  platform: Type.String({ default: 'GPL_DESKTOP' }),
  lang: Type.String({ minLength: 2, maxLength: 8, default: 'en' }),
  lobby_url: Type.String(),
  deposit_url: Type.Optional(Type.String()),
  country: Type.Optional(Type.String({ minLength: 2, maxLength: 4 })),
  ip: Type.Optional(Type.String()),
});

export type GameLaunchDto = Static<typeof GameLaunchSchema>;

export const GameRoundQuerySchema = Type.Object({
  round_id: Type.String({ minLength: 1 }),
  operator_id: Type.Union([Type.String(), Type.Number()]),
});

export type GameRoundQueryDto = Static<typeof GameRoundQuerySchema>;
