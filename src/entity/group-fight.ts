import { Entity, PrimaryGeneratedColumn, Column } from "typeorm";

@Entity()
export class GroupFight {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  groupId!: number;

  @Column()
  fighter1Id!: number;

  @Column()
  fighter2Id!: number;

  @Column({ nullable: true })
  messageId!: number | null;
}
