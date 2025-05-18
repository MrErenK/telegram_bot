import { Entity, Column, PrimaryColumn, OneToMany } from "typeorm";
import { GroupUser } from "./GroupUser";

@Entity()
export class User {
  // Telegram user ID
  @PrimaryColumn()
  id!: number;

  // User's Telegram username (optional)
  @Column("text", { nullable: true })
  username!: string | null;

  // User's first name
  @Column("text")
  firstName!: string;

  // User's last name (optional)
  @Column("text", { nullable: true })
  lastName!: string | null;

  // Registration date
  @Column("datetime")
  createdAt!: Date;

  // Last activity date
  @Column("datetime", { nullable: true })
  lastActiveAt!: Date | null;

  // Relation to group-specific profiles
  @OneToMany(() => GroupUser, (groupUser) => groupUser.user)
  groupUsers!: GroupUser[];
}
