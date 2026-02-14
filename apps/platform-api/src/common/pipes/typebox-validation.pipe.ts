import {
  PipeTransform,
  Injectable,
  BadRequestException,
} from '@nestjs/common';
import { TSchema } from '@sinclair/typebox';
import { TypeCompiler, TypeCheck } from '@sinclair/typebox/compiler';

/**
 * NestJS pipe that validates incoming data against a TypeBox schema.
 * Usage: @UsePipes(new TypeBoxValidationPipe(MySchema))
 */
@Injectable()
export class TypeBoxValidationPipe<T extends TSchema> implements PipeTransform {
  private readonly check: TypeCheck<T>;

  constructor(schema: T) {
    this.check = TypeCompiler.Compile(schema);
  }

  transform(value: unknown) {
    if (this.check.Check(value)) {
      return value;
    }

    const errors = [...this.check.Errors(value)].map((e) => ({
      path: e.path,
      message: e.message,
    }));

    throw new BadRequestException({
      statusCode: 400,
      message: 'Validation failed',
      errors,
    });
  }
}
