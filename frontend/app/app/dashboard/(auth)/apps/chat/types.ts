export type ChatItemProps = {
  date?: string;
  id: number;
  image?: string;
  is_archive?: boolean;
  last_message?: string;
  messages?: ChatMessageProps[];
  name?: string;
  status?: 'forwarded' | 'read' | 'sent';
  user?: UserPropsTypes;
  user_id: number;
};

export type ChatMessageProps = {
  content?: string;
  data?: ChatMessageDataProps;
  id: number;
  own_message?: boolean;
  read?: boolean;
  type?: string;
};

export type ChatMessageDataProps = {
  cover?: string;
  duration?: string;
  file_name?: string;
  images?: string[];
  path?: string;
  size?: string;
};

export type UserPropsTypes = {
  about?: string;
  avatar?: string;
  country?: string;
  email?: string;
  gender?: string;
  id: number;
  last_seen?: string;
  medias?: {
    path?: string;
    type?: string;
  }[];
  name: string;
  online_status?: 'danger' | 'success' | 'warning';
  phone?: string;
  social_links?: {
    name?: string;
    url?: string;
  }[];
  website?: string;
};

export type MediaListItemType = {
  type: string;
};

export type MessageStatusIconType = {
  status?: string;
};
