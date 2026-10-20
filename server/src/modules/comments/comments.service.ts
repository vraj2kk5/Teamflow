import { prisma } from "../../lib/prisma";
import { NotFoundError, ForbiddenError } from "../../lib/errors";
import { CreateCommentInput, UpdateCommentInput } from "./comments.schema";
import { Role } from "@prisma/client";

export class CommentsService {
  static async getComments(issueId: string, orgId: string) {
    const issue = await prisma.issue.findFirst({
      where: { id: issueId, organizationId: orgId },
    });

    if (!issue) {
      throw new NotFoundError("Issue not found");
    }

    return prisma.comment.findMany({
      where: { issueId },
      orderBy: { createdAt: "asc" },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
            jobTitle: true,
          },
        },
      },
    });
  }

  static async createComment(
    issueId: string,
    orgId: string,
    authorId: string,
    input: CreateCommentInput
  ) {
    const issue = await prisma.issue.findFirst({
      where: { id: issueId, organizationId: orgId },
    });

    if (!issue) {
      throw new NotFoundError("Issue not found");
    }

    return prisma.$transaction(async (tx) => {
      const comment = await tx.comment.create({
        data: {
          issueId,
          authorId,
          body: input.body,
        },
        include: {
          author: {
            select: {
              id: true,
              name: true,
              email: true,
              avatarUrl: true,
            },
          },
        },
      });

      await tx.activityLog.create({
        data: {
          organizationId: orgId,
          projectId: issue.projectId,
          issueId,
          actorId: authorId,
          action: "COMMENT_ADDED",
          metadata: {
            commentId: comment.id,
            snippet: input.body.substring(0, 100),
          },
        },
      });

      return comment;
    });
  }

  static async updateComment(
    commentId: string,
    authorId: string,
    input: UpdateCommentInput
  ) {
    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
    });

    if (!comment) {
      throw new NotFoundError("Comment not found");
    }

    if (comment.authorId !== authorId) {
      throw new ForbiddenError("You can only edit your own comments");
    }

    return prisma.comment.update({
      where: { id: commentId },
      data: { body: input.body },
      include: {
        author: {
          select: { id: true, name: true, avatarUrl: true },
        },
      },
    });
  }

  static async deleteComment(
    commentId: string,
    orgId: string,
    userId: string,
    role: Role
  ) {
    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
      include: {
        issue: {
          include: {
            project: true,
          },
        },
      },
    });

    if (!comment || comment.issue.organizationId !== orgId) {
      throw new NotFoundError("Comment not found");
    }

    const isAuthor = comment.authorId === userId;
    const isAdmin = role === Role.ADMIN;
    const isProjectOwner =
      role === Role.PROJECT_MANAGER && comment.issue.project.ownerId === userId;

    if (!isAuthor && !isAdmin && !isProjectOwner) {
      throw new ForbiddenError(
        "You do not have permission to delete this comment"
      );
    }

    await prisma.comment.delete({
      where: { id: commentId },
    });

    return { success: true };
  }
}
