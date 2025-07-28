import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User as FirebaseUser } from 'firebase/auth';
import { onAuthStateChange } from '@/lib/firebase';
import { apiRequest } from '@/lib/queryClient';
import { generateDeviceFingerprint } from '@/utils/device-fingerprint';

interface DatabaseUser {
  id: number;
  firebaseUid: string;
  email: string;
  displayName: string | null;
  photoURL: string | null;
  role: string;
  isActive: boolean;
  maxDevices: number;
}

interface AuthContextType {
  user: DatabaseUser | null;
  firebaseUser: FirebaseUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<DatabaseUser | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChange(async (authUser) => {
      setFirebaseUser(authUser);
      
      if (authUser) {
        try {
          console.log('🚀 Syncing user with backend:', {
            uid: authUser.uid,
            email: authUser.email,
            displayName: authUser.displayName,
          });
          
          // Generate device fingerprint
          const deviceInfo = generateDeviceFingerprint();
          console.log('🔍 Device fingerprint generated:', {
            fingerprint: deviceInfo.fingerprint.slice(0, 8) + '...',
            deviceName: deviceInfo.deviceName,
          });
          
          // Sync user with backend including device tracking
          const response = await apiRequest('POST', '/api/auth/login', {
            firebaseUid: authUser.uid,
            email: authUser.email,
            displayName: authUser.displayName,
            photoURL: authUser.photoURL,
            deviceFingerprint: deviceInfo.fingerprint,
            deviceName: deviceInfo.deviceName,
            deviceInfo: deviceInfo.deviceInfo,
          });
          
          const result = await response.json();
          console.log('✅ Backend sync successful:', result);
          
          if (result.success && result.user) {
            // Check if user account is pending approval
            if (result.user.role === 'pending' || !result.user.isActive) {
              alert('Tài khoản của bạn đang chờ admin phê duyệt. Vui lòng chờ và thử lại sau.');
              await import('firebase/auth').then(({ signOut, getAuth }) => signOut(getAuth()));
              return;
            }
            
            // Set the database user with id
            setUser(result.user);
            localStorage.setItem('databaseUser', JSON.stringify(result.user));
            
            // Store session info if provided
            if (result.session) {
              localStorage.setItem('sessionInfo', JSON.stringify(result.session));
            }
          } else if (!result.success) {
            // Handle device validation failures
            console.error('🚫 Login failed:', result.error);
            
            if (result.requiresApproval) {
              alert('Thiết bị của bạn cần được admin phê duyệt trước khi đăng nhập.');
            } else if (result.exceedsLimit) {
              alert('Bạn đã vượt quá số lượng thiết bị cho phép. Vui lòng liên hệ admin.');
            } else if (result.error && result.error.includes('pending')) {
              alert('Tài khoản của bạn đang chờ admin phê duyệt. Vui lòng chờ và thử lại sau.');
            } else {
              alert('Lỗi đăng nhập: ' + result.error);
            }
            
            // Force logout from Firebase
            await import('firebase/auth').then(({ signOut, getAuth }) => signOut(getAuth()));
          }
        } catch (error) {
          console.error('❌ Failed to sync user with backend:', error);
          alert('Có lỗi xảy ra khi đăng nhập. Vui lòng thử lại.');
        }
      } else {
        setUser(null);
        localStorage.removeItem('databaseUser');
      }
      
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const value = {
    user,
    firebaseUser,
    isLoading,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}