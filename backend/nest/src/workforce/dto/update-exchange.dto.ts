import { IsIn, IsString } from 'class-validator';

export const EXCHANGE_STATUSES = ['pending_peer', 'peer_accepted', 'pending_admin', 'approved', 'denied'] as const;

export class UpdateExchangeDto {
  @IsString()
  @IsIn(EXCHANGE_STATUSES)
  status!: (typeof EXCHANGE_STATUSES)[number];
}
