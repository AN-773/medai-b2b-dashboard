import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { courseResourceService } from '../services/courseResourceService';
import type { CourseResource, CourseResourceListResponse, CourseResourceKnowledgeProcessingResponse } from '../types/CourseResourceTypes';
import { ResourceProgressTracker, resourceFromProcessingResponse, shouldPollResource } from '../utils/documentProcessing';
import { ProgressivePoller } from '../utils/progressivePolling';

export const useProgressiveCourseResources = (courseIdentifier: string, page: number, limit: number) => {
  const [resources, setResources] = useState<CourseResource[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [connectionStale, setConnectionStale] = useState(false);
  const [lastCheckedAt, setLastCheckedAt] = useState<number | null>(null);
  const tracker = useMemo(() => new ResourceProgressTracker(), [courseIdentifier]);
  const pollerRef = useRef<ProgressivePoller<CourseResourceListResponse> | null>(null);

  useEffect(() => {
    let hasSnapshot = false;
    setResources([]);
    setTotal(0);
    setIsLoading(true);
    setLoadError(null);
    setConnectionStale(false);
    setLastCheckedAt(null);
    const poller = new ProgressivePoller({
      fetch: (signal) => courseResourceService.listTeacherCourseResources(
        courseIdentifier, { page, limit }, { signal },
      ),
      accept: (response) => {
        const rows = tracker.merge(response.resources ?? []);
        hasSnapshot = true;
        setResources(rows);
        setTotal(response.total ?? 0);
        setIsLoading(false);
        setLoadError(null);
        setConnectionStale(false);
        setLastCheckedAt(Date.now());
        return rows.some(shouldPollResource) || tracker.hasExpectedUpdates(rows);
      },
      onError: (error) => {
        setIsLoading(false);
        setConnectionStale(true);
        if (!hasSnapshot) setLoadError(error instanceof Error ? error.message : 'Could not load files.');
      },
    });
    pollerRef.current = poller;
    const resume = () => {
      if (!navigator.onLine) {
        setConnectionStale(true);
        poller.pause();
      } else if (document.visibilityState === 'hidden') poller.pause();
      else poller.resume();
    };
    // Includes terminal rows: another teacher may have retried while we were away.
    document.addEventListener('visibilitychange', resume);
    window.addEventListener('online', resume);
    window.addEventListener('offline', resume);
    window.addEventListener('pageshow', resume);
    window.addEventListener('focus', resume);
    resume();
    return () => {
      poller.dispose();
      pollerRef.current = null;
      document.removeEventListener('visibilitychange', resume);
      window.removeEventListener('online', resume);
      window.removeEventListener('offline', resume);
      window.removeEventListener('pageshow', resume);
      window.removeEventListener('focus', resume);
    };
  }, [courseIdentifier, page, limit, tracker]);

  const refresh = useCallback(async () => { await pollerRef.current?.refresh(); }, []);
  const acceptAction = useCallback(async (resource: CourseResource, response: CourseResourceKnowledgeProcessingResponse) => {
    tracker.expectUpdate(resource);
    const snapshot = resourceFromProcessingResponse(resource, response, courseIdentifier);
    if (snapshot) {
      const [merged] = tracker.merge([snapshot]);
      setResources((rows) => rows.map((row) =>
        (row.identifier || row.id) === (resource.identifier || resource.id) ? merged : row));
    }
    await refresh();
  }, [tracker, courseIdentifier, refresh]);
  const recoverAction = useCallback(async (resource: CourseResource, uncertain: boolean) => {
    if (uncertain) tracker.expectUpdate(resource);
    await refresh();
  }, [tracker, refresh]);
  return { resources, total, isLoading, loadError, connectionStale, lastCheckedAt, refresh, acceptAction, recoverAction, expectUpdate: tracker.expectUpdate };
};
