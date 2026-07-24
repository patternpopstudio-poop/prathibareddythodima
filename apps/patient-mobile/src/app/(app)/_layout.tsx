import { needsBasicDetails } from '@teleconsult/shared-types';
import { Redirect, Tabs } from 'expo-router';
import { Platform } from 'react-native';

import { Icon, type AppIconName } from '@/components/ui/icon';
import { Colors, FontFamily } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';

function TabIcon({
  name,
  color,
  focused,
}: {
  name: AppIconName;
  color: string;
  focused?: boolean;
}) {
  const iconName: AppIconName = name === 'home' ? (focused ? 'home' : 'homeOutline') : name;
  return <Icon name={iconName} size={24} color={color} />;
}

export default function AppLayout() {
  const { session, patient, isLoading } = useAuth();

  if (!isLoading && session && needsBasicDetails(patient)) {
    return <Redirect href="/(onboarding)/basic-details" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.primary900,
        tabBarInactiveTintColor: Colors.gray400,
        tabBarLabelStyle: {
          fontFamily: FontFamily.label,
          fontSize: 11,
          marginBottom: Platform.OS === 'ios' ? 0 : 4,
        },
        tabBarStyle: {
          backgroundColor: Colors.white,
          borderTopColor: Colors.border,
          height: Platform.OS === 'ios' ? 88 : 64,
          paddingTop: 6,
        },
      }}>
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => <TabIcon name="home" color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'My Health',
          tabBarIcon: ({ color, focused }) => <TabIcon name="person" color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: 'Messages',
          tabBarIcon: ({ color, focused }) => <TabIcon name="messages" color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="book"
        options={{
          title: 'Bookings',
          tabBarIcon: ({ color, focused }) => <TabIcon name="calendar" color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: 'More',
          tabBarIcon: ({ color, focused }) => <TabIcon name="more" color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="prescriptions"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="lab-reports"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="doctor/[id]"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="booking-confirmed"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
