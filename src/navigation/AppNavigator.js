import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import SplashScreen          from '../screens/SplashScreen';
import LoginScreen           from '../screens/auth/LoginScreen';
import RegisterScreen        from '../screens/auth/RegisterScreen';
import WorkerDashboard       from '../screens/worker/WorkerDashboard';
import ReportFaultScreen     from '../screens/worker/ReportFaultScreen';
import TechnicianDashboard   from '../screens/technician/TechnicianDashboard';
import SupervisorDashboard   from '../screens/supervisor/SupervisorDashboard';

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Splash">
        <Stack.Screen name="Splash"              component={SplashScreen}        options={{ headerShown: false }} />
        <Stack.Screen name="Login"               component={LoginScreen}          options={{ headerShown: false }} />
        <Stack.Screen name="Register"            component={RegisterScreen}       options={{ headerShown: false }} />
        <Stack.Screen name="WorkerDashboard"     component={WorkerDashboard}      options={{ headerShown: false }} />
        <Stack.Screen name="ReportFault"         component={ReportFaultScreen}    options={{ headerShown: false }} />
        <Stack.Screen name="TechnicianDashboard" component={TechnicianDashboard}  options={{ headerShown: false }} />
        <Stack.Screen name="SupervisorDashboard" component={SupervisorDashboard}  options={{ headerShown: false }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}