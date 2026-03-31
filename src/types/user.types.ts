export interface User {
  $id: string;
  email: string;
  name: string;
  phone?: string;
  role: 'buyer' | 'seller' | 'admin';
  profileImage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserDTO {
  name: string;
  email: string;
  phone?: string;
  role: 'buyer' | 'seller';
  profileImage?: string;
}

export interface UpdateUserDTO {
  name?: string;
  phone?: string;
  profileImage?: string;
}
