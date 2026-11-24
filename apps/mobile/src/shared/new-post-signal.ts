let pendingPostId: string | null = null;

export function markNewPost(postId: string): void {
  pendingPostId = postId;
}

export function consumeNewPost(): string | null {
  const postId = pendingPostId;
  pendingPostId = null;
  return postId;
}
