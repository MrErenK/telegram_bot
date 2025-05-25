import {
  Entity,
  Column,
  OneToMany,
  ManyToOne,
  PrimaryGeneratedColumn,
  JoinColumn,
} from "typeorm";
import { User } from "./User";

@Entity()
export class GroupUser {
  // Compound primary key using both user ID and group ID
  @PrimaryGeneratedColumn()
  id!: number;

  // Reference to the Telegram user
  @ManyToOne(() => User)
  @JoinColumn({ name: "userId" })
  user!: User;

  @Column()
  userId!: number;

  // The Telegram group ID
  @Column()
  groupId!: number;

  // User's Telegram username (cached for this group)
  @Column("text", { nullable: true })
  username!: string | null;

  // User's first name (cached for this group)
  @Column("text")
  firstName!: string;

  // User's last name (optional, cached for this group)
  @Column("text", { nullable: true })
  lastName!: string | null;

  // Current size in centimeters for this group
  @Column({ default: 0 })
  size!: number;

  // Last time user grew their dick in this group
  @Column("datetime", { nullable: true })
  lastGrowTime!: Date | null;

  // Total number of times user grew in this group
  @Column({ default: 0 })
  totalGrowths!: number;

  // Number of times the growth was positive in this group
  @Column({ default: 0 })
  positiveGrowths!: number;

  // Number of times the growth was negative in this group
  @Column({ default: 0 })
  negativeGrowths!: number;

  // Relation to growth history in this group
  @OneToMany(() => GroupGrowth, (growth) => growth.groupUser)
  growths!: GroupGrowth[];

  // Fights initiated by this user in this group
  @OneToMany(() => GroupFight, (fight) => fight.initiator)
  initiatedFights!: GroupFight[];

  // Fights where this user was the target in this group
  @OneToMany(() => GroupFight, (fight) => fight.target)
  targetedFights!: GroupFight[];

  // Wins in fights in this group
  @Column({ default: 0 })
  wins!: number;

  // Losses in fights in this group
  @Column({ default: 0 })
  losses!: number;

  // Creation time
  @Column("datetime")
  createdAt!: Date;
}

@Entity()
export class GroupGrowth {
  // Auto-generated primary key
  @PrimaryGeneratedColumn()
  id!: number;

  // Relation to group user
  @ManyToOne(() => GroupUser, (groupUser) => groupUser.growths)
  groupUser!: GroupUser;

  // The amount of growth (positive or negative)
  @Column("float")
  amount!: number;

  // Whether this was a special growth (e.g., "Dick of the Day" bonus)
  @Column({ default: false })
  isSpecial!: boolean;

  // Reason for special growth, if any
  @Column("text", { nullable: true })
  specialReason!: string | null;

  // When the growth happened
  @Column("datetime")
  timestamp!: Date;
}

@Entity()
export class GroupFight {
  // Auto-generated primary key
  @PrimaryGeneratedColumn()
  id!: number;

  // The user who initiated the fight
  @ManyToOne(() => GroupUser, (user) => user.initiatedFights)
  initiator!: GroupUser;

  // The user who was challenged
  @ManyToOne(() => GroupUser, (user) => user.targetedFights, { nullable: true })
  target!: GroupUser | null;

  // The group ID where this fight happened
  @Column()
  groupId!: number;

  // The wager amount (how many cm the winner takes from the loser)
  @Column("float", { default: 1.0 })
  wager!: number;

  // Roll values for users
  @Column("integer", { nullable: true })
  initiatorRoll!: number | null;

  @Column("integer", { nullable: true })
  targetRoll!: number | null;

  // ID of the winner
  @Column("integer", { nullable: true })
  winnerId!: number | null;

  // ID of the loser
  @Column("integer", { nullable: true })
  loserId!: number | null;

  // Winner reference
  @ManyToOne(() => GroupUser, { nullable: true })
  winner!: GroupUser | null;

  // Fight status
  @Column("text", { default: "pending" })
  status!: string;

  // Time when the fight was completed
  @Column("datetime", { nullable: true })
  completedAt!: Date | null;

  // Whether the wager was returned (mercy)
  @Column({ default: false })
  wagerReturned!: boolean;

  // When the fight happened
  @Column("datetime")
  timestamp!: Date;

  // The chat where the fight took place
  @Column("integer", { nullable: true })
  chatId!: number | null;

  // Message ID of the fight challenge message
  @Column("integer", { nullable: true })
  messageId!: number | null;
}
