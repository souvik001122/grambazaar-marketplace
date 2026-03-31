import { ID, Query } from 'appwrite';
import { databases, appwriteConfig } from '../config/appwrite';
import { AdminLog, Report, CreateReportDTO } from '../types/common.types';
import { sendNotification } from './notificationService';
import { getUsersByRole } from './userService';
import { getSellerById } from './sellerService';

const DISPUTE_META_PREFIX = '[GBZ_DISPUTE_META]';

const encodeDisputeMetaInDetails = (details: string, proofUrls: string[]): string => {
  return `${DISPUTE_META_PREFIX}${JSON.stringify({ details, proofUrls })}`;
};

const decodeDisputeMetaFromDetails = (details: string): { details: string; proofUrls: string[] } | null => {
  if (!details?.startsWith(DISPUTE_META_PREFIX)) return null;
  try {
    const payload = JSON.parse(details.slice(DISPUTE_META_PREFIX.length));
    return {
      details: typeof payload?.details === 'string' ? payload.details : '',
      proofUrls: Array.isArray(payload?.proofUrls) ? payload.proofUrls : [],
    };
  } catch {
    return null;
  }
};

const parseReportDocument = (doc: any): Report => {
  let proofUrls: string[] = [];
  let details = typeof doc.details === 'string' ? doc.details : '';

  const disputeMeta = decodeDisputeMetaFromDetails(details);
  if (disputeMeta) {
    details = disputeMeta.details;
    proofUrls = disputeMeta.proofUrls;
  }

  if (Array.isArray(doc.proofUrls)) {
    proofUrls = doc.proofUrls;
  } else if (typeof doc.proofUrls === 'string' && doc.proofUrls.trim()) {
    try {
      const parsed = JSON.parse(doc.proofUrls);
      if (Array.isArray(parsed)) proofUrls = parsed;
    } catch {
      proofUrls = [];
    }
  }

  return {
    ...(doc as Report),
    details,
    proofUrls,
  };
};

/**
 * Create admin log
 */
export const createAdminLog = async (
  adminId: string,
  action: string,
  entityType: string,
  entityId: string,
  details?: string
): Promise<AdminLog> => {
  try {
    const log = await databases.createDocument(
      appwriteConfig.databaseId,
      appwriteConfig.adminLogsCollectionId,
      ID.unique(),
      {
        adminId,
        action,
        entityType,
        entityId,
        details: details || '',
        createdAt: new Date().toISOString(),
      }
    );

    return log as unknown as AdminLog;
  } catch (error) {
    console.error('Error creating admin log:', error);
    throw new Error('Failed to create admin log');
  }
};

/**
 * Get admin logs
 */
export const getAdminLogs = async (
  limit: number = 50,
  offset: number = 0
): Promise<AdminLog[]> => {
  try {
    const response = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.adminLogsCollectionId,
      [
        Query.orderDesc('createdAt'),
        Query.limit(limit),
        Query.offset(offset),
      ]
    );

    return response.documents as unknown as AdminLog[];
  } catch (error) {
    console.error('Error fetching admin logs:', error);
    return [];
  }
};

/**
 * Get logs by admin
 */
export const getLogsByAdmin = async (adminId: string): Promise<AdminLog[]> => {
  try {
    const response = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.adminLogsCollectionId,
      [
        Query.equal('adminId', adminId),
        Query.orderDesc('createdAt'),
      ]
    );

    return response.documents as unknown as AdminLog[];
  } catch (error) {
    console.error('Error fetching admin logs:', error);
    return [];
  }
};

/**
 * Create report
 */
export const createReport = async (data: CreateReportDTO): Promise<Report> => {
  try {
    const basePayload = {
      reportedBy: data.reportedBy,
      reportedEntity: data.reportedEntity,
      entityId: data.entityId,
      reason: data.reason,
      details: data.details || '',
      issueCategory: data.issueCategory || '',
      orderId: data.orderId || '',
      courierName: data.courierName || '',
      trackingId: data.trackingId || '',
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    try {
      const report = await databases.createDocument(
        appwriteConfig.databaseId,
        appwriteConfig.reportsCollectionId,
        ID.unique(),
        {
          ...basePayload,
          proofUrls: JSON.stringify(data.proofUrls || []),
        }
      );

      return parseReportDocument(report);
    } catch (firstError: any) {
      const errorMessage = String(firstError?.message || '').toLowerCase();
      const hasProofUrls = Array.isArray(data.proofUrls) && data.proofUrls.length > 0;
      const proofAttrUnsupported =
        errorMessage.includes('proofurls') ||
        errorMessage.includes('attribute') ||
        errorMessage.includes('document structure');

      if (!proofAttrUnsupported) {
        throw firstError;
      }

      // Fallback for schemas that cannot add a dedicated proofUrls field.
      // If proof files are present, persist them in details metadata; otherwise keep details plain.
      const fallbackDetails = hasProofUrls
        ? encodeDisputeMetaInDetails(basePayload.details, data.proofUrls || [])
        : basePayload.details;

      const report = await databases.createDocument(
        appwriteConfig.databaseId,
        appwriteConfig.reportsCollectionId,
        ID.unique(),
        {
          ...basePayload,
          details: fallbackDetails,
        }
      );

      return parseReportDocument(report);
    }
  } catch (error) {
    console.error('Error creating report:', error);
    throw new Error('Failed to create report');
  }
};

/**
 * Create buyer order dispute report with notifications for admin + seller
 */
export const createOrderDisputeReport = async (data: {
  buyerId: string;
  sellerId: string;
  orderId: string;
  issueCategory: string;
  reason: string;
  details?: string;
  proofUrls?: string[];
  courierName?: string;
  trackingId?: string;
}): Promise<Report> => {
  const existingOpenDisputes = await databases.listDocuments(
    appwriteConfig.databaseId,
    appwriteConfig.reportsCollectionId,
    [
      Query.equal('reportedEntity', 'order'),
      Query.equal('entityId', data.orderId),
      Query.equal('reportedBy', data.buyerId),
      Query.equal('status', ['pending', 'investigating']),
      Query.limit(1),
    ]
  );

  if (existingOpenDisputes.total > 0) {
    throw new Error('An active issue already exists for this order. Please wait for admin resolution.');
  }

  const report = await createReport({
    reportedBy: data.buyerId,
    reportedEntity: 'order',
    entityId: data.orderId,
    reason: data.reason,
    details: data.details,
    issueCategory: data.issueCategory,
    proofUrls: data.proofUrls,
    orderId: data.orderId,
    courierName: data.courierName,
    trackingId: data.trackingId,
  });

  const admins = await getUsersByRole('admin');
  const seller = await getSellerById(data.sellerId);

  await Promise.all([
    ...admins.map((admin) =>
      sendNotification(
        admin.$id,
        `New delivery dispute raised for order #${data.orderId.slice(-8).toUpperCase()}.`,
        'report_update',
        report.$id,
        'report'
      )
    ),
    seller
      ? sendNotification(
          seller.userId,
          `Buyer raised a delivery issue for order #${data.orderId.slice(-8).toUpperCase()}. Admin review is pending.`,
          'report_update',
          report.$id,
          'report'
        )
      : Promise.resolve(),
    sendNotification(
      data.buyerId,
      `Your issue for order #${data.orderId.slice(-8).toUpperCase()} has been submitted. Admin will review shortly.`,
      'report_update',
      report.$id,
      'report'
    ),
  ]);

  return report;
};

/**
 * Get reports for a specific order (optionally by reporter)
 */
export const getReportsByOrder = async (orderId: string, reporterId?: string): Promise<Report[]> => {
  try {
    const queries = [Query.equal('entityId', orderId), Query.orderDesc('createdAt')];
    if (reporterId) {
      queries.push(Query.equal('reportedBy', reporterId));
    }
    const response = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.reportsCollectionId,
      queries
    );
    return response.documents.map(parseReportDocument);
  } catch (error) {
    console.error('Error fetching order reports:', error);
    return [];
  }
};

/**
 * Get pending reports
 */
export const getPendingReports = async (): Promise<Report[]> => {
  try {
    const response = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.reportsCollectionId,
      [
        Query.equal('status', 'pending'),
        Query.orderDesc('createdAt'),
      ]
    );

    return response.documents.map(parseReportDocument);
  } catch (error) {
    console.error('Error fetching pending reports:', error);
    return [];
  }
};

/**
 * Get all reports
 */
export const getAllReports = async (): Promise<Report[]> => {
  try {
    const response = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.reportsCollectionId,
      [Query.orderDesc('createdAt')]
    );

    return response.documents.map(parseReportDocument);
  } catch (error) {
    console.error('Error fetching reports:', error);
    return [];
  }
};

/**
 * Update report status
 */
export const updateReportStatus = async (
  reportId: string,
  status: 'investigating' | 'resolved' | 'dismissed',
  adminId: string,
  resolution?: string
): Promise<Report> => {
  try {
    const updated = await databases.updateDocument(
      appwriteConfig.databaseId,
      appwriteConfig.reportsCollectionId,
      reportId,
      {
        status,
        resolvedBy: adminId,
        resolution: resolution || '',
        resolvedAt: new Date().toISOString(),
      }
    );

    // Notify reporter
    const reportDoc = parseReportDocument(updated);
    await sendNotification(
      reportDoc.reportedBy,
      `Your report has been ${status}. ${resolution || ''}`,
      'report_update',
      reportId
    );

    return reportDoc;
  } catch (error) {
    console.error('Error updating report status:', error);
    throw new Error('Failed to update report status');
  }
};

/**
 * Get analytics - Dashboard stats
 */
export const getAnalytics = async (): Promise<{
  totalUsers: number;
  totalSellers: number;
  pendingSellers: number;
  approvedSellers: number;
  totalProducts: number;
  activeProducts: number;
  pendingProducts: number;
  totalReviews: number;
  pendingReports: number;
}> => {
  try {
    // Get counts in parallel
    const [
      usersCount,
      sellersCount,
      pendingSellersCount,
      verifiedSellersCount,
      productsCount,
      activeProductsCount,
      pendingProductsCount,
      reviewsCount,
      pendingReportsCount,
    ] = await Promise.all([
      databases.listDocuments(appwriteConfig.databaseId, appwriteConfig.usersCollectionId, [
        Query.limit(1),
      ]),
      databases.listDocuments(appwriteConfig.databaseId, appwriteConfig.sellersCollectionId, [
        Query.limit(1),
      ]),
      databases.listDocuments(appwriteConfig.databaseId, appwriteConfig.sellersCollectionId, [
        Query.equal('verificationStatus', 'pending'),
        Query.limit(1),
      ]),
      databases.listDocuments(appwriteConfig.databaseId, appwriteConfig.sellersCollectionId, [
        Query.equal('verificationStatus', 'approved'),
        Query.limit(1),
      ]),
      databases.listDocuments(appwriteConfig.databaseId, appwriteConfig.productsCollectionId, [
        Query.limit(1),
      ]),
      databases.listDocuments(appwriteConfig.databaseId, appwriteConfig.productsCollectionId, [
        Query.equal('status', 'active'),
        Query.limit(1),
      ]),
      databases.listDocuments(appwriteConfig.databaseId, appwriteConfig.productsCollectionId, [
        Query.equal('status', 'pending'),
        Query.limit(1),
      ]),
      databases.listDocuments(appwriteConfig.databaseId, appwriteConfig.reviewsCollectionId, [
        Query.limit(1),
      ]),
      databases.listDocuments(appwriteConfig.databaseId, appwriteConfig.reportsCollectionId, [
        Query.equal('status', 'pending'),
        Query.limit(1),
      ]),
    ]);

    return {
      totalUsers: usersCount.total,
      totalSellers: sellersCount.total,
      pendingSellers: pendingSellersCount.total,
      approvedSellers: verifiedSellersCount.total,
      totalProducts: productsCount.total,
      activeProducts: activeProductsCount.total,
      pendingProducts: pendingProductsCount.total,
      totalReviews: reviewsCount.total,
      pendingReports: pendingReportsCount.total,
    };
  } catch (error) {
    console.error('Error fetching analytics:', error);
    return {
      totalUsers: 0,
      totalSellers: 0,
      pendingSellers: 0,
      approvedSellers: 0,
      totalProducts: 0,
      activeProducts: 0,
      pendingProducts: 0,
      totalReviews: 0,
      pendingReports: 0,
    };
  }
};

/**
 * Get region-wise stats by fetching sellers and counting by state
 */
export const getRegionStats = async (): Promise<Array<{ region: string; count: number }>> => {
  try {
    const response = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.sellersCollectionId,
      [Query.limit(500)]
    );
    const regionMap: Record<string, number> = {};
    response.documents.forEach((doc: any) => {
      const state = doc.state || 'Unknown';
      regionMap[state] = (regionMap[state] || 0) + 1;
    });
    return Object.entries(regionMap)
      .map(([region, count]) => ({ region, count }))
      .sort((a, b) => b.count - a.count);
  } catch (error) {
    console.error('Error fetching region stats:', error);
    return [];
  }
};

/**
 * Get category-wise product counts
 */
export const getCategoryStats = async (): Promise<Array<{ category: string; count: number }>> => {
  try {
    const response = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.productsCollectionId,
      [Query.limit(500)]
    );
    const catMap: Record<string, number> = {};
    response.documents.forEach((doc: any) => {
      const cat = doc.category || 'Uncategorized';
      catMap[cat] = (catMap[cat] || 0) + 1;
    });
    return Object.entries(catMap)
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count);
  } catch (error) {
    console.error('Error fetching category stats:', error);
    return [];
  }
};

/**
 * Get all sellers (Admin)
 */
export const getAllSellers = async (): Promise<any[]> => {
  try {
    const response = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.sellersCollectionId,
      [Query.orderDesc('createdAt'), Query.limit(200)]
    );
    return response.documents;
  } catch (error) {
    console.error('Error fetching all sellers:', error);
    return [];
  }
};

/**
 * Get all orders (Admin)
 */
export const getAllOrders = async (): Promise<any[]> => {
  try {
    const response = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.ordersCollectionId,
      [Query.orderDesc('createdAt'), Query.limit(200)]
    );
    return response.documents.map((doc: any) => {
      let items = doc.items;
      if (typeof items === 'string') {
        try { items = JSON.parse(items); } catch { items = []; }
      }

      const rawStatus = (doc.status || '').toLowerCase();
      const status = rawStatus === 'payment_pending'
        ? 'processing'
        : rawStatus === 'payment_confirmed'
        ? 'processing'
        : rawStatus || 'pending';

      const rawPayment = (doc.paymentStatus || '').toLowerCase();
      const paymentStatus = status === 'shipped' || status === 'delivered'
        ? 'paid'
        : status === 'cancelled' && (rawPayment === 'paid' || rawPayment === 'success')
        ? 'refunded'
        : (rawPayment === 'success' || rawPayment === 'paid' ? 'paid' : rawPayment || 'pending');

      return { ...doc, status, paymentStatus, items: items || [] };
    });
  } catch (error) {
    console.error('Error fetching all orders:', error);
    return [];
  }
};

/**
 * Get all users (Admin)
 */
export const getAllUsers = async (): Promise<any[]> => {
  try {
    const response = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.usersCollectionId,
      [Query.orderDesc('createdAt'), Query.limit(500)]
    );
    return response.documents;
  } catch (error) {
    console.error('Error fetching all users:', error);
    return [];
  }
};

/**
 * Get all products (Admin)
 */
export const getAllProducts = async (): Promise<any[]> => {
  try {
    const response = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.productsCollectionId,
      [Query.orderDesc('createdAt'), Query.limit(500)]
    );
    return response.documents;
  } catch (error) {
    console.error('Error fetching all products:', error);
    return [];
  }
};

/**
 * Block/Unblock seller (Admin)
 */
export const blockSeller = async (sellerId: string, blocked: boolean, adminId: string): Promise<void> => {
  try {
    await databases.updateDocument(
      appwriteConfig.databaseId,
      appwriteConfig.sellersCollectionId,
      sellerId,
      {
        verificationStatus: blocked ? 'blocked' : 'approved',
        verifiedBadge: !blocked,
        updatedAt: new Date().toISOString(),
      }
    );
    await createAdminLog(adminId, blocked ? 'block_seller' : 'unblock_seller', 'seller', sellerId);
  } catch (error) {
    console.error('Error blocking/unblocking seller:', error);
    throw new Error('Failed to update seller status');
  }
};

/**
 * Delete product (Admin)
 */
export const adminDeleteProduct = async (productId: string, adminId: string): Promise<void> => {
  try {
    await databases.deleteDocument(
      appwriteConfig.databaseId,
      appwriteConfig.productsCollectionId,
      productId
    );
    await createAdminLog(adminId, 'delete_product', 'product', productId);
  } catch (error) {
    console.error('Error deleting product:', error);
    throw new Error('Failed to delete product');
  }
};

/**
 * Get recent admin activity for the dashboard
 */
export const getRecentActivity = async (limit: number = 10): Promise<AdminLog[]> => {
  return getAdminLogs(limit, 0);
};
