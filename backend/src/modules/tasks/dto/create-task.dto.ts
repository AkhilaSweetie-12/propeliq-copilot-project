import { Transform, Type } from 'class-transformer';
import { TaskPriority, TaskStatus } from '@prisma/client';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateTaskDto {
  @IsUUID()
  projectId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  @Transform(({ value }) => String(value).trim())
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  @Transform(({ value }) => (value ? String(value).trim() : undefined))
  description?: string;

  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @IsOptional()
  @Type(() => Date)
  dueDate?: Date;

  @IsOptional()
  @IsUUID()
  assigneeId?: string;
}