import { UserRepository } from './user.repository';
import { TicketRepository } from './ticket.repository';
import { CommentRepository } from './comment.repository';

export { BaseRepository } from './base.repository';
export { UserRepository } from './user.repository';
export { TicketRepository } from './ticket.repository';
export { CommentRepository } from './comment.repository';

// Repository instances (singletons)
export const userRepository = new UserRepository();
export const ticketRepository = new TicketRepository();
export const commentRepository = new CommentRepository();