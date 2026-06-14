import { useState, useEffect } from "react";
import { supabase, invokeEdgeFunction } from "../../api/supabaseClient";
import { useAuth } from "../../context/AuthContext";

type UserProfile = {
  id: string;
  email: string;
  full_name: string;
  role: string;
  mobile_number?: string;
};

export default function PasswordReset() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  
  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  
  // Generated credentials (shown after successful reset)
  const [generatedPassword, setGeneratedPassword] = useState<{
    userId: string;
    userName: string;
    tempPassword: string;
  } | null>(null);
  
  /* ---------------- Generate Secure Temporary Password ---------------- */
  
  function generateTempPassword(): string {
    const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const lowercase = "abcdefghijklmnopqrstuvwxyz";
    const numbers = "0123456789";
    const special = "!@#$%^&*";
    const all = uppercase + lowercase + numbers + special;
    
    let password = "";
    // Ensure at least one of each type
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += special[Math.floor(Math.random() * special.length)];
    
    // Fill remaining characters randomly
    for (let i = 4; i < 12; i++) {
      password += all[Math.floor(Math.random() * all.length)];
    }
    
    // Shuffle password
    return password.split('').sort(() => Math.random() - 0.5).join('');
  }
  
  /* ---------------- Search Users ---------------- */
  
  async function handleSearch() {
    if (!searchQuery.trim()) {
      setMessage({ type: "error", text: "Please enter a search query" });
      return;
    }
    
    setSearchLoading(true);
    setMessage(null);
    setSearchResults([]);
    setSelectedUser(null);
    setGeneratedPassword(null);
    
    try {
      const query = searchQuery.trim().toLowerCase();
      
      // Search by email, name, or mobile number
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, full_name, role, mobile_number')
        .or(`email.ilike.%${query}%,full_name.ilike.%${query}%,mobile_number.ilike.%${query}%`)
        .order('full_name');
      
      if (error) {
        throw new Error(`Search failed: ${error.message}`);
      }
      
      if (!data || data.length === 0) {
        setMessage({ type: "error", text: "No users found matching your search" });
        setSearchResults([]);
      } else {
        setSearchResults(data);
        setMessage({ type: "success", text: `Found ${data.length} user(s)` });
      }
      
    } catch (err: any) {
      console.error("Search error:", err);
      setMessage({ type: "error", text: err.message || "Search failed" });
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  }
  
  /* ---------------- Reset Password ---------------- */
  
  async function handlePasswordReset() {
    if (!selectedUser) {
      setMessage({ type: "error", text: "Please select a user first" });
      return;
    }
    
    setLoading(true);
    setMessage(null);
    
    try {
      const tempPassword = generateTempPassword();
      
      // Call Edge Function to reset password securely
      const result = await invokeEdgeFunction('reset-user-password', {
        userId: selectedUser.id,
        newTempPassword: tempPassword,
      });
      
      if (!result.success) {
        throw new Error(result.error || 'Password reset failed');
      }
      
      // Success: Show credentials to admin
      setGeneratedPassword({
        userId: selectedUser.id,
        userName: selectedUser.full_name,
        tempPassword: tempPassword,
      });
      
      setMessage({ 
        type: "success", 
        text: `Password reset successfully for ${selectedUser.full_name}` 
      });
      
    } catch (err: any) {
      console.error("Password reset error:", err);
      setMessage({ 
        type: "error", 
        text: err.message || "Password reset failed" 
      });
    } finally {
      setLoading(false);
    }
  }
  
  /* ---------------- Copy to Clipboard ---------------- */
  
  async function copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setMessage({ type: "success", text: "Copied to clipboard!" });
      setTimeout(() => setMessage(null), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  }
  
  /* ---------------- Clear All ---------------- */
  
  function handleClear() {
    setSearchQuery("");
    setSearchResults([]);
    setSelectedUser(null);
    setGeneratedPassword(null);
    setMessage(null);
  }
  
  /* ---------------- Render ---------------- */
  
  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-lg border border-amber-200 p-4">
        <h3 className="text-lg font-semibold text-slate-800 mb-2">🔑 Password Reset</h3>
        <p className="text-sm text-slate-600">
          Help users who forgot their password by generating a new temporary password.
          Users will be required to change this temporary password on their next login.
        </p>
      </div>
      
      {/* Search Section */}
      <div className="bg-white rounded-lg border border-slate-200 p-5 space-y-4">
        <h4 className="text-md font-semibold text-slate-800">Search User</h4>
        
        <div className="flex gap-3">
          <input
            type="text"
            className="flex-1 px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="Search by email, name, or mobile number..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            disabled={searchLoading || loading}
          />
          <button
            onClick={handleSearch}
            disabled={searchLoading || loading}
            className="px-6 bg-primary text-white py-2.5 rounded-lg font-semibold hover:bg-blue-700 active:scale-95 disabled:opacity-50 transition-all"
          >
            {searchLoading ? "Searching..." : "Search"}
          </button>
          <button
            onClick={handleClear}
            disabled={searchLoading || loading}
            className="px-6 bg-slate-200 text-slate-700 py-2.5 rounded-lg font-semibold hover:bg-slate-300 active:scale-95 disabled:opacity-50 transition-all"
          >
            Clear
          </button>
        </div>
      </div>
      
      {/* Search Results */}
      {searchResults.length > 0 && (
        <div className="bg-white rounded-lg border border-slate-200 p-5 space-y-4">
          <h4 className="text-md font-semibold text-slate-800">
            Search Results ({searchResults.length})
          </h4>
          
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {searchResults.map((user) => (
              <div
                key={user.id}
                className={`p-4 border rounded-lg cursor-pointer transition-all ${
                  selectedUser?.id === user.id
                    ? "border-primary bg-blue-50"
                    : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                }`}
                onClick={() => {
                  setSelectedUser(user);
                  setGeneratedPassword(null);
                  setMessage(null);
                }}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="font-semibold text-slate-800">{user.full_name}</div>
                    <div className="text-sm text-slate-600 mt-1">
                      {user.email}
                      {user.mobile_number && (
                        <span className="ml-3 text-slate-500">📱 {user.mobile_number}</span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      <span className={`px-2 py-0.5 rounded ${
                        user.role === 'admin' ? 'bg-red-100 text-red-700' :
                        user.role === 'supervisor' ? 'bg-blue-100 text-blue-700' :
                        'bg-green-100 text-green-700'
                      }`}>
                        {user.role.toUpperCase()}
                      </span>
                    </div>
                  </div>
                  {selectedUser?.id === user.id && (
                    <span className="text-primary text-2xl">✓</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Reset Password Button */}
      {selectedUser && (
        <div className="bg-white rounded-lg border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="text-md font-semibold text-slate-800">
                Reset Password for: {selectedUser.full_name}
              </h4>
              <p className="text-sm text-slate-600 mt-1">
                Email: {selectedUser.email}
              </p>
            </div>
          </div>
          
          <button
            onClick={handlePasswordReset}
            disabled={loading}
            className="w-full bg-amber-600 text-white py-3 rounded-lg font-semibold hover:bg-amber-700 active:scale-95 disabled:opacity-50 transition-all"
          >
            {loading ? "Resetting Password..." : "Generate & Reset Temporary Password"}
          </button>
          
          <p className="text-xs text-amber-700 mt-2 text-center">
            ⚠️ This will generate a new temporary password and force the user to change it on next login
          </p>
        </div>
      )}
      
      {/* Generated Password Display */}
      {generatedPassword && (
        <div className="bg-amber-50 border border-amber-300 rounded-lg p-5 space-y-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl">🔐</span>
            <div className="flex-1">
              <h4 className="text-md font-semibold text-amber-900 mb-2">
                Temporary Password Generated
              </h4>
              <p className="text-sm text-amber-800 mb-4">
                Share this temporary password securely with {generatedPassword.userName}. 
                They must change it on their next login. Do NOT share via insecure channels.
              </p>
              
              <div className="space-y-3">
                <div className="bg-white rounded-lg p-3 border border-amber-200">
                  <div className="text-xs font-semibold text-slate-600 mb-1">User</div>
                  <div className="text-sm font-mono text-slate-800">
                    {generatedPassword.userName}
                  </div>
                </div>
                
                <div className="bg-white rounded-lg p-3 border border-amber-200">
                  <div className="text-xs font-semibold text-slate-600 mb-1">Temporary Password</div>
                  <div className="flex items-center justify-between gap-2">
                    <code className="text-sm font-mono text-slate-800 break-all">
                      {generatedPassword.tempPassword}
                    </code>
                    <button
                      onClick={() => copyToClipboard(generatedPassword.tempPassword)}
                      className="px-3 py-1 bg-slate-100 hover:bg-slate-200 rounded text-xs font-semibold transition-colors"
                    >
                      Copy
                    </button>
                  </div>
                </div>
              </div>
              
              <div className="mt-4 p-3 bg-amber-100 border border-amber-300 rounded-lg">
                <p className="text-xs text-amber-900 font-semibold mb-1">⚠️ Security Reminder</p>
                <ul className="text-xs text-amber-800 space-y-1 ml-4 list-disc">
                  <li>Share password via secure channel only (encrypted email, chat, or in-person)</li>
                  <li>User MUST change password on next login (system enforced)</li>
                  <li>Do NOT save this password anywhere</li>
                  <li>Inform user their old password no longer works</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Message */}
      {message && (
        <div
          className={`rounded-lg border p-4 ${
            message.type === "success"
              ? "bg-green-50 border-green-200 text-green-800"
              : "bg-red-50 border-red-200 text-red-800"
          }`}
        >
          <p className="text-sm font-medium">{message.text}</p>
        </div>
      )}
      
      {/* Help Section */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-5">
        <h4 className="text-md font-semibold text-slate-800 mb-3">📋 Password Reset Process</h4>
        <ol className="text-sm text-slate-600 space-y-2 ml-5 list-decimal">
          <li>Admin searches for user by email, name, or mobile number</li>
          <li>Admin selects the user from search results</li>
          <li>Admin clicks "Generate & Reset Temporary Password"</li>
          <li>System generates secure 12-character temporary password</li>
          <li>System updates user's password and sets first_login flag</li>
          <li>Admin shares temporary password securely with user</li>
          <li>User logs in with temporary password</li>
          <li>System forces user to create new permanent password</li>
          <li>User gains access with their new password</li>
        </ol>
        
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-xs text-blue-900 font-semibold mb-1">💡 Best Practices</p>
          <ul className="text-xs text-blue-800 space-y-1 ml-4 list-disc">
            <li>Verify user identity before resetting password (via phone/video call)</li>
            <li>Share temporary password via secure channel only</li>
            <li>Instruct user to change password immediately after logging in</li>
            <li>Never save or store temporary passwords</li>
            <li>If user doesn't login within reasonable time, reset again</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
