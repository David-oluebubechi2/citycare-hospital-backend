import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { MessagesService } from './messages.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('Messages')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('messages')
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Post('send')
  @ApiOperation({ summary: 'Send a direct message' })
  send(@Request() req: any, @Body() body: { recipientId: string; content: string; type?: string; attachments?: string[] }) {
    return this.messagesService.send({
      senderId: req.user.userId,
      recipientId: body.recipientId,
      content: body.content,
      type: body.type,
      attachments: body.attachments,
    });
  }

  @Post('send-group')
  @ApiOperation({ summary: 'Send a group message' })
  sendGroupMessage(@Request() req: any, @Body() body: any) {
    return this.messagesService.sendGroupMessage({
      ...body,
      senderId: req.user.userId,
    });
  }

  @Get('conversations')
  @ApiOperation({ summary: 'Get all conversations for current user' })
  getConversations(@Request() req: any) {
    return this.messagesService.getConversations(req.user.userId);
  }

  @Get('conversation/:userId')
  @ApiOperation({ summary: 'Get conversation with a specific user' })
  getConversation(@Request() req: any, @Param('userId') userId: string, @Query() query: any) {
    return this.messagesService.getConversation(req.user.userId, userId, query);
  }

  @Get('room/:roomId')
  @ApiOperation({ summary: 'Get messages in a room' })
  getRoomMessages(@Param('roomId') roomId: string, @Query() query: any) {
    return this.messagesService.getRoomMessages(roomId, query);
  }

  @Get('unread')
  @ApiOperation({ summary: 'Get unread message count' })
  async getUnreadCount(@Request() req: any) {
    const count = await this.messagesService.getUnreadCount(req.user.userId);
    return { count };
  }

  @Put(':id/read')
  @ApiOperation({ summary: 'Mark message as read' })
  markAsRead(@Param('id') id: string) {
    return this.messagesService.markAsRead(id);
  }

  @Put('conversation/:userId/read')
  @ApiOperation({ summary: 'Mark conversation as read' })
  markConversationAsRead(@Request() req: any, @Param('userId') userId: string) {
    return this.messagesService.markConversationAsRead(req.user.userId, userId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a message' })
  deleteMessage(@Param('id') id: string) {
    return this.messagesService.deleteMessage(id);
  }
}
