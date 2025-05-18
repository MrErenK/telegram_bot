import {
  Entity,
  Column,
  ManyToOne,
  PrimaryGeneratedColumn,
  JoinColumn,
} from "typeorm";
import { GroupUser } from "./GroupUser";

@Entity()
export class GroupDuello {
  @PrimaryGeneratedColumn()
  id!: number;

  // The Telegram group ID
  @Column()
  groupId!: number;

  // Challenger
  @ManyToOne(() => GroupUser)
  @JoinColumn({ name: "challengerId" })
  challenger!: GroupUser;

  @Column()
  challengerId!: number;

  // Opponent (can be null for open challenges)
  @ManyToOne(() => GroupUser, { nullable: true })
  @JoinColumn({ name: "opponentId" })
  opponent!: GroupUser | null;

  @Column({ nullable: true })
  opponentId!: number | null;

  // The style selected by the challenger
  @Column("text")
  challengerStyle!: string;

  // The style selected by the opponent (if accepted)
  @Column("text", { nullable: true })
  opponentStyle!: string | null;

  // Wager amount (cm)
  @Column("float", { default: 1.0 })
  wager!: number;

  // Current turn (1 = challenger, 2 = opponent)
  @Column("integer", { default: 0 })
  currentTurn!: number;

  // Status (pending, active, completed, cancelled)
  @Column("text", { default: "pending" })
  status!: string;

  // Expiration time for pending challenges
  @Column("datetime")
  expiresAt!: Date;

  // Result information
  @Column("integer", { nullable: true })
  winnerId!: number | null;

  @ManyToOne(() => GroupUser, { nullable: true })
  @JoinColumn({ name: "winnerId" })
  winner!: GroupUser | null;

  // Fight history as JSON string
  @Column("text", { default: "[]" })
  history!: string;

  // Creation time
  @Column("datetime")
  createdAt!: Date;

  // Completion time (when fight ended)
  @Column("datetime", { nullable: true })
  completedAt!: Date | null;
}
