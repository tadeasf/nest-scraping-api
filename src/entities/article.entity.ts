import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity()
export class Article {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  title: string;

  @Column()
  url: string;

  @Column({ unique: true })
  contentHash: string;

  @Column()
  source: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ nullable: true })
  author: string;

  @Column({ type: 'datetime', nullable: true })
  publishedAt: Date;

  @Column({ nullable: true })
  imageUrl: string;

  @CreateDateColumn()
  createdAt: Date;
}
