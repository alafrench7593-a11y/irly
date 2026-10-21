/** The team's words for each line of the moderation log (the server keeps its own names). */
export const ACTION_LABEL: Record<string, string> = {
  'role.set': 'Role changed',
  'role.owner_granted': 'Owner granted from the server',
  'case.status': 'Report status changed',
  'message.read': 'Reported private message read',
  'content.removed': 'Content removed',
  'content.hide': 'Hidden',
  'content.restore': 'Restored',
  'content.delete': 'Deleted',
  'sanction.warning': 'Warning sent',
  'sanction.suspension': 'Member suspended',
  'sanction.ban': 'Member banned',
  'sanction.lifted': 'Sanction lifted',
  'account.deleted': 'Account deleted',
  'community.edited': 'Community edited',
  'community.photo_replaced': 'Community photo replaced',
  'community.photo_removed': 'Community photo removed',
  'cover.community': 'Community photo changed',
  'cover.activity': 'Activity photo changed',
  'settings.changed': 'Setting changed',
  'email.retry': 'Report email sent again',
};

export const ITEM_LABEL: Record<string, string> = {
  activity: 'Activity',
  community: 'Community',
  community_post: 'Community post',
  comment: 'Comment',
  irl_post: 'Live post',
  message: 'Private message',
  profile: 'Profile',
};
