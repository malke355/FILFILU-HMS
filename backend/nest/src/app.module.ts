import path from 'path';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { DirectoryModule } from './directory/directory.module';
import { IntakeModule } from './intake/intake.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: path.resolve(__dirname, '../../.env'),
    }),
    PrismaModule,
    AuthModule,
    DirectoryModule,
    IntakeModule,
  ],
})
export class AppModule {}
