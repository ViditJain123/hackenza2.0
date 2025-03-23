'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { CheckCircleIcon, XCircleIcon, ChatBubbleLeftRightIcon } from '@heroicons/react/24/solid';

interface Query {
  verifiedAt: string;
  _id: string;
  query: string;
  response: string;
  status: 'verified' | 'not_verified' | 'incorrect';
  doctorCategory: string;
  doctorComment?: string;
  createdAt: string;
}

interface Pagination {
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export default function DashboardPage() {
  const { isLoaded, userId } = useAuth();
  const [queries, setQueries] = useState<Query[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentTab, setCurrentTab] = useState<string>('not_verified');
  const [comments, setComments] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState<Record<string, boolean>>({});
  const [notification, setNotification] = useState<{type: 'success' | 'error', message: string} | null>(null);

  const fetchQueries = async (status = 'not_verified', page = 1) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/clinician_dashboard?status=${status}&page=${page}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch queries');
      }
      
      const data = await response.json();
      setQueries(data.queries);
      setPagination(data.pagination);
      
      // Initialize comments object
      const initialComments: Record<string, string> = {};
      data.queries.forEach((query: Query) => {
        initialComments[query._id] = query.doctorComment || '';
      });
      setComments(initialComments);
      
    } catch (err) {
      setError('Failed to load queries. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isLoaded && userId) {
      fetchQueries(currentTab);
    }
  }, [isLoaded, userId, currentTab]);

  const handleTabChange = (value: string) => {
    setCurrentTab(value);
    fetchQueries(value);
  };

  const handleCommentChange = (id: string, value: string) => {
    setComments(prev => ({
      ...prev,
      [id]: value
    }));
  };

  const handleVerify = async (id: string, status: 'verified' | 'incorrect') => {
    try {
      setSubmitting(prev => ({ ...prev, [id]: true }));
      
      const response = await fetch('/api/clinician_dashboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          queryId: id,
          status,
          doctorComment: comments[id]
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to update query');
      }
      
      // Show notification
      setNotification({
        type: 'success',
        message: `Query ${status === 'verified' ? 'verified' : 'marked as incorrect'} successfully!`
      });
      
      // Refresh the queries list
      fetchQueries(currentTab);
      
      // Clear notification after 3 seconds
      setTimeout(() => {
        setNotification(null);
      }, 3000);
      
    } catch (err) {
      setNotification({
        type: 'error',
        message: 'Failed to update query. Please try again.'
      });
      console.error(err);
    } finally {
      setSubmitting(prev => ({ ...prev, [id]: false }));
    }
  };

  const renderPagination = () => {
    if (!pagination) return null;
    
    const pages = Array.from({ length: pagination.pages }, (_, i) => i + 1);
    
    return (
      <div className="flex justify-center mt-6 gap-2">
        {pages.map(page => (
          <button
            key={page}
            className={`px-3 py-1 text-sm rounded-md focus:outline-none ${
              page === pagination.page 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
            onClick={() => fetchQueries(currentTab, page)}
          >
            {page}
          </button>
        ))}
      </div>
    );
  };

  if (!isLoaded) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-800 mb-2">Medical Review Dashboard</h1>
        <p className="text-slate-600">
          Review and verify AI-generated responses to patient queries based on your medical expertise.
        </p>
      </div>
      
      {notification && (
        <div 
          className={`mb-4 p-4 rounded-lg ${
            notification.type === 'success' 
              ? 'bg-green-50 text-green-800 border border-green-200' 
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {notification.message}
        </div>
      )}
      
      <div className="mb-6">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            <button
              onClick={() => handleTabChange('not_verified')}
              className={`py-2 px-4 font-medium text-sm mr-2 ${
                currentTab === 'not_verified' 
                  ? 'border-b-2 border-blue-500 text-blue-600' 
                  : 'text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Pending Verification
            </button>
            <button
              onClick={() => handleTabChange('verified')}
              className={`py-2 px-4 font-medium text-sm mr-2 ${
                currentTab === 'verified' 
                  ? 'border-b-2 border-blue-500 text-blue-600' 
                  : 'text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Verified Queries
            </button>
            <button
              onClick={() => handleTabChange('incorrect')}
              className={`py-2 px-4 font-medium text-sm ${
                currentTab === 'incorrect' 
                  ? 'border-b-2 border-blue-500 text-blue-600' 
                  : 'text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Incorrect Responses
            </button>
          </nav>
        </div>
      </div>
      
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"></div>
        </div>
      ) : error ? (
        <div className="p-4 rounded-lg bg-red-50 text-red-800 border border-red-200">
          {error}
        </div>
      ) : queries.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <ChatBubbleLeftRightIcon className="h-12 w-12 mx-auto text-gray-400" />
          <h3 className="mt-4 text-lg font-semibold text-gray-900">No queries found</h3>
          <p className="text-gray-500">
            {currentTab === 'not_verified' ? 
              "There are no pending queries requiring your verification at this time." :
              `No ${currentTab} queries available.`}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {queries.map((query) => (
            <div key={query._id} className="bg-white rounded-lg shadow overflow-hidden">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2 p-4">
                  <div className="flex justify-between items-start mb-3">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      query.status === 'verified' 
                        ? 'bg-green-100 text-green-800' 
                        : query.status === 'incorrect' 
                          ? 'bg-red-100 text-red-800' 
                          : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {query.status === 'verified' ? 'Verified' : 
                       query.status === 'incorrect' ? 'Incorrect' : 'Pending'}
                    </span>
                    <div className="text-sm text-gray-500">
                      {new Date(query.createdAt).toLocaleString()}
                    </div>
                  </div>
                  
                  <div className="mb-4">
                    <h3 className="font-semibold text-gray-900 mb-1">Patient Query</h3>
                    <p className="text-gray-700 bg-gray-50 p-3 rounded">{query.query}</p>
                  </div>
                  
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">AI Response</h3>
                    <div className="text-gray-700 bg-blue-50 p-3 rounded border-l-4 border-blue-500">
                      {query.response.replace('*This response is not yet verified by the doctor.*', '')}
                    </div>
                  </div>
                  
                  {query.doctorComment && query.status !== 'not_verified' && (
                    <div className="mt-4">
                      <h3 className="font-semibold text-gray-900 mb-1">Doctor Comment</h3>
                      <div className="text-gray-700 bg-green-50 p-3 rounded border-l-4 border-green-500">
                        {query.doctorComment}
                      </div>
                    </div>
                  )}
                </div>
                
                <div className={`p-4 ${
                  currentTab === 'not_verified' ? 'bg-gray-50' : 'bg-gray-50 opacity-75'
                }`}>
                  <h3 className="font-semibold text-gray-900 mb-2">Verification</h3>
                  
                  {currentTab === 'not_verified' ? (
                    <>
                      <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Add Comment (optional)
                        </label>
                        <textarea
                          placeholder="Add your medical expertise or corrections..."
                          value={comments[query._id] || ''}
                          onChange={(e) => handleCommentChange(query._id, e.target.value)}
                          className="w-full border border-gray-300 rounded-md p-2 focus:ring-blue-500 focus:border-blue-500"
                          rows={5}
                        />
                      </div>
                      
                      <div className="flex flex-col gap-2">
                        <button
                          onClick={() => handleVerify(query._id, 'verified')}
                          disabled={submitting[query._id]}
                          className="w-full flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {submitting[query._id] ? (
                            <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                          ) : (
                            <CheckCircleIcon className="h-5 w-5 mr-2" />
                          )}
                          Verify as Correct
                        </button>
                        
                        <button
                          onClick={() => handleVerify(query._id, 'incorrect')}
                          disabled={submitting[query._id]}
                          className="w-full flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {submitting[query._id] ? (
                            <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                          ) : (
                            <XCircleIcon className="h-5 w-5 mr-2" />
                          )}
                          Mark as Incorrect
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="text-sm text-gray-600">
                      <p>This query has been {query.status === 'verified' ? 'verified' : 'marked as incorrect'}.</p>
                      {query.verifiedAt && (
                        <p className="mt-2">
                          Verified on: {new Date(query.verifiedAt).toLocaleString()}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      
      {renderPagination()}
    </div>
  );
}