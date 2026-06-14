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

export default function DeleteUser() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  
  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  
  // Deletion confirmation
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [deletionReason, setDeletionReason] = useState("");
  
  // Deletion result
  const [deletionResult, setDeletionResult] = useState<{
    success: boolean;
    message: string;
    deletedUser?: UserProfile;
  } | null>(null);
  
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
    setDeletionResult(null);
    setShowConfirmation(false);
    
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
  
  /* ---------------- Delete User ---------------- */
  
  async function handleDeleteUser() {
    if (!selectedUser) {
      setMessage({ type: "error", text: "Please select a user first" });
      return;
    }
    
    setLoading(true);
    setMessage(null);
    
    try {
      // Call Edge Function to delete user securely
      const result = await invokeEdgeFunction('delete-user', {
        userId: selectedUser.id,
        reason: deletionReason || null,
      });
      
      if (!result.success) {
        throw new Error(result.error || 'User deletion failed');
      }
      
      // Success: Show result
      setDeletionResult({
        success: true,
        message: result.message,
        deletedUser: result.deletedUser,
      });
      
      // Reset form
      setSelectedUser(null);
      setShowConfirmation(false);
      setDeletionReason("");
      setSearchQuery("");
      setSearchResults([]);
      
      setMessage({ 
        type: "success", 
        text: `User ${selectedUser.full_name} has been successfully deleted` 
      });
      
    } catch (err: any) {
      console.error("Deletion error:", err);
      setMessage({ 
        type: "error", 
        text: err.message || "User deletion failed" 
      });
    } finally {
      setLoading(false);
    }
  }
  
  /* ---------------- Clear All ---------------- */
  
  function handleClear() {
    setSearchQuery("");
    setSearchResults([]);
    setSelectedUser(null);
    setDeletionResult(null);
    setShowConfirmation(false);
    setDeletionReason("");
    setMessage(null);
  }
  
  /* ---------------- Render ---------------- */
  
  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-red-50 to-orange-50 rounded-lg border border-red-200 p-4">
        <h3 className="text-lg font-semibold text-slate-800 mb-2">🗑️ Delete User Account</h3>
        <p className="text-sm text-slate-600">
          Permanently remove user accounts from the system. This action cannot be undone.
          User data will be marked as deleted and archived for audit purposes.
        </p>
      </div>
      
      {/* Search Section */}
      <div className="bg-white rounded-lg border border-slate-200 p-5 space-y-4">
        <h4 className="text-md font-semibold text-slate-800">Search User to Delete</h4>
        
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
                    ? "border-red-500 bg-red-50"
                    : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                }`}
                onClick={() => {
                  setSelectedUser(user);
                  setDeletionResult(null);
                  setShowConfirmation(false);
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
                    <span className="text-red-500 text-2xl">✓</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Deletion Confirmation */}
      {selectedUser && !showConfirmation && !deletionResult && (
        <div className="bg-white rounded-lg border border-slate-200 p-5 space-y-4">
          <div className="flex items-start gap-3 mb-4">
            <span className="text-red-500 text-2xl">⚠️</span>
            <div className="flex-1">
              <h4 className="text-md font-semibold text-slate-800">
                Delete: {selectedUser.full_name}
              </h4>
              <p className="text-sm text-slate-600 mt-1">
                Email: {selectedUser.email}
              </p>
            </div>
          </div>
          
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm text-red-900 font-semibold mb-2">⚠️ This action is irreversible</p>
            <ul className="text-sm text-red-800 space-y-1 ml-4 list-disc">
              <li>User account will be permanently deleted from the system</li>
              <li>User will no longer be able to log in</li>
              <li>All authentication records will be removed</li>
              <li>User data will be marked as deleted for audit trail</li>
            </ul>
          </div>
          
          <div className="space-y-3">
            <label className="block">
              <span className="text-sm font-semibold text-slate-700 mb-2 block">
                Reason for Deletion (Optional)
              </span>
              <textarea
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                placeholder="Document the reason for this deletion (e.g., Left organization, Account duplicate, User request)"
                value={deletionReason}
                onChange={(e) => setDeletionReason(e.target.value)}
                rows={3}
              />
            </label>
          </div>
          
          <div className="flex gap-3 justify-end">
            <button
              onClick={() => {
                setSelectedUser(null);
                setDeletionReason("");
              }}
              className="px-6 bg-slate-200 text-slate-700 py-2.5 rounded-lg font-semibold hover:bg-slate-300 active:scale-95 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={() => setShowConfirmation(true)}
              className="px-6 bg-red-600 text-white py-2.5 rounded-lg font-semibold hover:bg-red-700 active:scale-95 transition-all"
            >
              Proceed to Delete
            </button>
          </div>
        </div>
      )}
      
      {/* Final Confirmation */}
      {showConfirmation && selectedUser && !deletionResult && (
        <div className="bg-red-50 border border-red-300 rounded-lg p-5 space-y-4">
          <div className="flex items-start gap-3">
            <span className="text-4xl">🛑</span>
            <div className="flex-1">
              <h4 className="text-lg font-bold text-red-900 mb-2">
                Final Confirmation: Delete {selectedUser.full_name}?
              </h4>
              <p className="text-sm text-red-800 mb-4">
                This is your last chance to cancel. Once deleted, this user account cannot be recovered.
              </p>
              
              <div className="bg-red-100 border border-red-300 rounded p-3 mb-4">
                <p className="text-sm text-red-900">
                  <strong>Type the user's email to confirm:</strong><br />
                  <code className="font-mono text-red-800">{selectedUser.email}</code>
                </p>
              </div>
              
              <input
                type="text"
                className="w-full px-4 py-2.5 border border-red-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 mb-4"
                placeholder="Confirm by typing the email address..."
                id="confirmEmail"
              />
              
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => {
                    setShowConfirmation(false);
                    setSelectedUser(null);
                    setDeletionReason("");
                  }}
                  className="px-6 bg-slate-200 text-slate-700 py-2.5 rounded-lg font-semibold hover:bg-slate-300 active:scale-95 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    const input = (document.getElementById('confirmEmail') as HTMLInputElement).value;
                    if (input !== selectedUser.email) {
                      setMessage({ type: "error", text: "Email does not match. Deletion cancelled." });
                      setShowConfirmation(false);
                      setSelectedUser(null);
                      setDeletionReason("");
                      return;
                    }
                    handleDeleteUser();
                  }}
                  disabled={loading}
                  className="px-6 bg-red-600 text-white py-2.5 rounded-lg font-semibold hover:bg-red-700 active:scale-95 disabled:opacity-50 transition-all"
                >
                  {loading ? "Deleting..." : "Yes, Delete Permanently"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Deletion Result */}
      {deletionResult && (
        <div className={`rounded-lg border p-5 ${
          deletionResult.success
            ? "bg-green-50 border-green-300"
            : "bg-red-50 border-red-300"
        }`}>
          <div className="flex items-start gap-3">
            <span className="text-4xl">{deletionResult.success ? "✅" : "❌"}</span>
            <div className="flex-1">
              <h4 className={`text-lg font-bold ${
                deletionResult.success ? "text-green-900" : "text-red-900"
              }`}>
                {deletionResult.message}
              </h4>
              
              {deletionResult.deletedUser && (
                <div className={`mt-3 p-3 rounded border ${
                  deletionResult.success
                    ? "bg-white border-green-200"
                    : "bg-white border-red-200"
                }`}>
                  <p className="text-sm text-slate-700">
                    <strong>Deleted User:</strong> {deletionResult.deletedUser.full_name}<br />
                    <strong>Email:</strong> {deletionResult.deletedUser.email}<br />
                    <strong>Role:</strong> {deletionResult.deletedUser.role.toUpperCase()}
                  </p>
                </div>
              )}
              
              <div className="mt-4">
                <button
                  onClick={handleClear}
                  className="px-6 bg-primary text-white py-2.5 rounded-lg font-semibold hover:bg-blue-700 active:scale-95 transition-all"
                >
                  Delete Another User
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Message */}
      {message && !deletionResult && (
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
        <h4 className="text-md font-semibold text-slate-800 mb-3">📋 User Deletion Process</h4>
        <ol className="text-sm text-slate-600 space-y-2 ml-5 list-decimal">
          <li>Admin searches for user by email, name, or mobile number</li>
          <li>Admin selects the user from search results</li>
          <li>Admin optionally provides deletion reason</li>
          <li>Admin clicks "Proceed to Delete"</li>
          <li>Admin must confirm by typing the user's email</li>
          <li>System deletes user from authentication</li>
          <li>User profile marked as deleted with audit trail</li>
          <li>User loses immediate access; deletion is logged</li>
        </ol>
        
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-xs text-red-900 font-semibold mb-1">⚠️ Important</p>
          <ul className="text-xs text-red-800 space-y-1 ml-4 list-disc">
            <li>Deletion is PERMANENT and cannot be reversed</li>
            <li>Always verify you are deleting the correct user</li>
            <li>Document the reason for deletion for audit trail</li>
            <li>Consider password reset if user just locked out</li>
            <li>Notify users through proper channels before deletion</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
