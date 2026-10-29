const db = require('../config/db');

// Map of active SSE connections. Key: user ID, Value: Array of response objects
const sseClients = new Map();

// Initialize the audit table if it doesn't exist
const initDb = async () => {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS soporte_auditoria (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        conversacion_id UUID REFERENCES soporte_conversaciones(id) ON DELETE CASCADE,
        accion VARCHAR(50) NOT NULL,
        usuario_id UUID,
        usuario_tipo VARCHAR(20),
        detalles TEXT,
        fecha TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
  } catch (e) {
    console.error('Error initializing support audit table:', e);
  }
};
initDb();

const streamConversations = (req, res) => {
  const userId = req.user.id;
  
  // Set headers for SSE
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  
  res.write(': connected\n\n');

  if (!sseClients.has(userId)) {
    sseClients.set(userId, []);
  }
  sseClients.get(userId).push(res);

  const heartbeat = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 15000);

  req.on('close', () => {
    clearInterval(heartbeat);
    const clients = sseClients.get(userId);
    if (clients) {
      const index = clients.indexOf(res);
      if (index !== -1) {
        clients.splice(index, 1);
      }
      if (clients.length === 0) {
        sseClients.delete(userId);
      }
    }
  });
};

const notifyUser = (userId, type, payload) => {
  const clients = sseClients.get(userId);
  if (clients && clients.length > 0) {
    const data = JSON.stringify({ type, payload });
    clients.forEach(client => {
      client.write(`data: ${data}\n\n`);
    });
  }
};

const notifySuperAdmins = async (type, payload) => {
  try {
    const adminRes = await db.query("SELECT id FROM restaurantes WHERE rol = 'SUPER_ADMIN'");
    adminRes.rows.forEach(admin => {
      notifyUser(admin.id, type, payload);
    });
  } catch(err) {
    console.error('Error notifying super admins:', err);
  }
};

const logAudit = async (conversacion_id, accion, usuario_id, usuario_tipo, detalles) => {
  try {
    await db.query(
      `INSERT INTO soporte_auditoria (conversacion_id, accion, usuario_id, usuario_tipo, detalles) VALUES ($1, $2, $3, $4, $5)`,
      [conversacion_id, accion, usuario_id, usuario_tipo, detalles || null]
    );
  } catch (error) {
    console.error('Error logging audit:', error);
  }
};

const getMisConversaciones = async (req, res) => {
  const restaurante_id = req.user.id;
  try {
    const query = `
      SELECT 
        c.*,
        COALESCE(a.nombre_dueno, 'Soporte') as agente_nombre
      FROM soporte_conversaciones c
      LEFT JOIN restaurantes a ON c.admin_id = a.id
      WHERE c.restaurante_id = $1
      ORDER BY c.fecha_creacion DESC
    `;
    const result = await db.query(query, [restaurante_id]);
    const conversaciones = result.rows;
    
    // get messages for all conversations
    for (let i = 0; i < conversaciones.length; i++) {
        const msgQuery = `SELECT id, conversacion_id, remitente_id, remitente_tipo, mensaje, created_at FROM soporte_mensajes WHERE conversacion_id = $1 ORDER BY created_at ASC`;
        const msgResult = await db.query(msgQuery, [conversaciones[i].id]);
        conversaciones[i].mensajes = msgResult.rows;
    }
    
    res.json(conversaciones);
  } catch (error) {
    console.error('Error in getMisConversaciones:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const sendMessageRestaurante = async (req, res) => {
  const restaurante_id = req.user.id;
  const { mensaje } = req.body;
  
  if (!mensaje) return res.status(400).json({ error: 'Mensaje requerido' });

  try {
    await db.query('BEGIN');
    
    // Check if there is an open conversation
    let convResult = await db.query(
      `SELECT * FROM soporte_conversaciones WHERE restaurante_id = $1 AND estado != 'cerrada' LIMIT 1 FOR UPDATE`,
      [restaurante_id]
    );

    let conversacion;
    let isNew = false;
    if (convResult.rows.length === 0) {
      // Create new one
      const newConvResult = await db.query(
        `INSERT INTO soporte_conversaciones (restaurante_id, estado, mensajes_restaurante_count) 
         VALUES ($1, 'pendiente', 0) RETURNING *`,
        [restaurante_id]
      );
      conversacion = newConvResult.rows[0];
      isNew = true;
    } else {
      conversacion = convResult.rows[0];
    }

    if (conversacion.estado === 'pendiente' && conversacion.mensajes_restaurante_count >= 5) {
      await db.query('ROLLBACK');
      return res.status(403).json({ error: 'Has alcanzado el límite de mensajes. Espera a que un agente de soporte responda para continuar la conversación.' });
    }

    // Insert message
    const msgResult = await db.query(
      `INSERT INTO soporte_mensajes (conversacion_id, remitente_id, remitente_tipo, mensaje) VALUES ($1, $2, 'RESTAURANTE', $3) RETURNING id, conversacion_id, remitente_id, remitente_tipo, mensaje, created_at`,
      [conversacion.id, restaurante_id, mensaje]
    );

    // Update conversation
    await db.query(
      `UPDATE soporte_conversaciones 
       SET ultima_actividad = CURRENT_TIMESTAMP, 
           mensajes_restaurante_count = mensajes_restaurante_count + 1,
           leido_admin = false
       WHERE id = $1`,
      [conversacion.id]
    );

    await db.query('COMMIT');
    
    const mensajeGuardado = msgResult.rows[0];
    let autoMensajeGuardado = null;

    if (isNew) {
      await logAudit(conversacion.id, 'CREADA', restaurante_id, 'RESTAURANTE', 'Conversación creada por el restaurante');

      // Auto welcome message ÚNICAMENTE en la creación de una nueva conversación
      const autoMsg = "Hola, bienvenido al soporte de Mexicana MX. Ya estamos revisando tu caso. En unos momentos un agente te responderá.";
      const autoMsgResult = await db.query(
        `INSERT INTO soporte_mensajes (conversacion_id, remitente_id, remitente_tipo, mensaje) VALUES ($1, NULL, 'SOPORTE', $2) RETURNING id, conversacion_id, remitente_id, remitente_tipo, mensaje, created_at`,
        [conversacion.id, autoMsg]
      );
      
      autoMensajeGuardado = autoMsgResult.rows[0];
      
      notifyUser(restaurante_id, 'NEW_MESSAGE', {
        conversacion_id: conversacion.id,
        mensaje: autoMensajeGuardado
      });
    }
    
    // Notify admins via SSE
    notifySuperAdmins('NEW_MESSAGE', {
      conversacion_id: conversacion.id,
      restaurante_id: restaurante_id,
      mensaje: mensajeGuardado
    });

    res.status(201).json({ 
      mensaje: mensajeGuardado, 
      conversacion_id: conversacion.id,
      mensajes_restaurante_count: conversacion.mensajes_restaurante_count + 1,
      autoMensaje: autoMensajeGuardado
    });
  } catch (error) {
    await db.query('ROLLBACK');
    console.error('Error in sendMessageRestaurante:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const rateConversacion = async (req, res) => {
  const restaurante_id = req.user.id;
  const { conversacion_id } = req.params;
  const { calificacion } = req.body;

  try {
    const result = await db.query(
      `SELECT * FROM soporte_conversaciones WHERE id = $1 AND restaurante_id = $2`,
      [conversacion_id, restaurante_id]
    );

    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    
    const conv = result.rows[0];
    if (conv.estado !== 'cerrada') return res.status(400).json({ error: 'Solo se pueden calificar conversaciones cerradas' });
    if (conv.calificacion !== null) return res.status(400).json({ error: 'Ya fue calificada' });

    await db.query(
      `UPDATE soporte_conversaciones SET calificacion = $1 WHERE id = $2`,
      [calificacion, conversacion_id]
    );

    await logAudit(conversacion_id, 'CALIFICADA', restaurante_id, 'RESTAURANTE', `Calificada con \${calificacion}`);

    res.json({ success: true, message: 'Calificada exitosamente' });
  } catch (error) {
    console.error('Error in rateConversacion:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getConversationsAdmin = async (req, res) => {
  try {
    const query = `
      SELECT 
        c.*,
        r.nombre_negocio, r.nombre_dueno, r.email, r.plan
      FROM soporte_conversaciones c
      JOIN restaurantes r ON c.restaurante_id = r.id
      ORDER BY 
        CASE WHEN c.estado = 'pendiente' THEN 1
             WHEN c.estado = 'cerrada' THEN 3
             ELSE 2 END,
        c.ultima_actividad DESC
    `;
    const result = await db.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('Error in getConversationsAdmin:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getConversationMessagesAdmin = async (req, res) => {
  const { conversacion_id } = req.params;
  try {
    await db.query('BEGIN');
    await db.query(`UPDATE soporte_conversaciones SET leido_admin = true WHERE id = $1`, [conversacion_id]);
    const result = await db.query(`SELECT id, conversacion_id, remitente_id, remitente_tipo, mensaje, created_at FROM soporte_mensajes WHERE conversacion_id = $1 ORDER BY created_at ASC`, [conversacion_id]);
    await db.query('COMMIT');
    res.json(result.rows);
  } catch (error) {
    await db.query('ROLLBACK');
    console.error('Error in getConversationMessagesAdmin:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const aceptarConversacion = async (req, res) => {
  const admin_id = req.user.id;
  const { conversacion_id } = req.params;

  try {
    await db.query('BEGIN');
    const convResult = await db.query(`SELECT * FROM soporte_conversaciones WHERE id = $1 FOR UPDATE`, [conversacion_id]);
    if (convResult.rows.length === 0) {
      await db.query('ROLLBACK');
      return res.status(404).json({ error: 'Conversacion no encontrada' });
    }
    const conv = convResult.rows[0];

    if (conv.admin_id !== null && conv.admin_id !== admin_id) {
      await db.query('ROLLBACK');
      return res.status(403).json({ error: 'La conversación ya está asignada a otro agente' });
    }

    if (conv.estado === 'cerrada') {
      await db.query('ROLLBACK');
      return res.status(400).json({ error: 'La conversación está cerrada' });
    }

    const updatedResult = await db.query(
      `UPDATE soporte_conversaciones SET admin_id = $1, estado = 'en_atencion' WHERE id = $2 RETURNING *`,
      [admin_id, conversacion_id]
    );

    await logAudit(conversacion_id, 'ASIGNADA', admin_id, 'SOPORTE', 'Conversación asignada al agente');

    await db.query('COMMIT');

    notifyUser(conv.restaurante_id, 'CONVERSATION_ASSIGNED', {
      conversacion_id: conversacion_id,
      admin_id: admin_id
    });
    const admin_name = req.user.nombre_dueno || 'Soporte';
    notifyUser(conv.restaurante_id, 'CONVERSATION_UPDATED', {
      conversacion_id: conversacion_id,
      estado: 'en_atencion',
      admin_id: admin_id,
      agente_nombre: admin_name
    });
    notifySuperAdmins('CONVERSATION_UPDATED', {
      conversacion_id: conversacion_id,
      estado: 'en_atencion',
      admin_id: admin_id
    });

    res.json(updatedResult.rows[0]);
  } catch (error) {
    await db.query('ROLLBACK');
    console.error('Error in aceptarConversacion:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const sendMessageAdmin = async (req, res) => {
  const admin_id = req.user.id;
  const admin_name = req.user.nombre_dueno || 'Soporte';
  const { conversacion_id } = req.params;
  const { mensaje } = req.body;

  if (!mensaje) return res.status(400).json({ error: 'Contenido requerido' });

  try {
    await db.query('BEGIN');
    const convResult = await db.query(`SELECT * FROM soporte_conversaciones WHERE id = $1 FOR UPDATE`, [conversacion_id]);
    if (convResult.rows.length === 0) {
      await db.query('ROLLBACK');
      return res.status(404).json({ error: 'Conversacion no encontrada' });
    }
    
    const conv = convResult.rows[0];
    if (conv.estado === 'cerrada') {
      await db.query('ROLLBACK');
      return res.status(403).json({ error: 'La conversación está cerrada.' });
    }

    if (conv.admin_id && conv.admin_id !== admin_id) {
      await db.query('ROLLBACK');
      return res.status(403).json({ error: 'La conversación está asignada a otro agente.' });
    }

    let estadoChanged = false;
    let presMensajeGuardado = null;
    if (conv.estado === 'pendiente') {
      const presMsg = `Buenos días. Soy ${admin_name}, del equipo de soporte. Con gusto atenderé tu solicitud.`;
      const presResult = await db.query(
        `INSERT INTO soporte_mensajes (conversacion_id, remitente_id, remitente_tipo, mensaje) VALUES ($1, $2, 'SOPORTE', $3) RETURNING id, conversacion_id, remitente_id, remitente_tipo, mensaje, created_at`,
        [conversacion_id, admin_id, presMsg]
      );
      presMensajeGuardado = presResult.rows[0];
      
      await db.query(
        `UPDATE soporte_conversaciones SET estado = 'en_atencion', admin_id = $1 WHERE id = $2`,
        [admin_id, conversacion_id]
      );

      await logAudit(conversacion_id, 'ASIGNADA', admin_id, 'SOPORTE', 'Asignada automáticamente al enviar mensaje');
      estadoChanged = true;
    }

    const msgResult = await db.query(
      `INSERT INTO soporte_mensajes (conversacion_id, remitente_id, remitente_tipo, mensaje) VALUES ($1, $2, 'SOPORTE', $3) RETURNING id, conversacion_id, remitente_id, remitente_tipo, mensaje, created_at`,
      [conversacion_id, admin_id, mensaje]
    );

    await db.query(
      `UPDATE soporte_conversaciones 
       SET ultima_actividad = CURRENT_TIMESTAMP, 
           admin_id = $1,
           leido_restaurante = false,
           mensajes_restaurante_count = 0
       WHERE id = $2`,
      [admin_id, conversacion_id]
    );

    await db.query('COMMIT');
    
    const mensajeGuardado = msgResult.rows[0];
    
    if (presMensajeGuardado) {
      notifyUser(conv.restaurante_id, 'NEW_MESSAGE', {
        conversacion_id: conversacion_id,
        mensaje: presMensajeGuardado
      });
    }

    notifyUser(conv.restaurante_id, 'NEW_MESSAGE', {
      conversacion_id: conversacion_id,
      mensaje: mensajeGuardado
    });

    if (estadoChanged) {
      notifyUser(conv.restaurante_id, 'CONVERSATION_UPDATED', {
        conversacion_id: conversacion_id,
        estado: 'en_atencion',
        admin_id: admin_id,
        agente_nombre: admin_name
      });
      notifySuperAdmins('CONVERSATION_UPDATED', {
        conversacion_id: conversacion_id,
        estado: 'en_atencion',
        admin_id: admin_id
      });
    }
    
    res.status(201).json({ message: 'Admin message sent', mensaje: mensajeGuardado });
  } catch (error) {
    await db.query('ROLLBACK');
    console.error('Error in sendMessageAdmin:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const closeConversation = async (req, res) => {
  const admin_id = req.user.id;
  const { conversacion_id } = req.params;
  try {
    const result = await db.query(
      `UPDATE soporte_conversaciones SET estado = 'cerrada', fecha_cierre = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *`,
      [conversacion_id]
    );
    
    if (result.rows.length > 0) {
      await logAudit(conversacion_id, 'CERRADA', admin_id, 'SOPORTE', 'Conversación cerrada por agente');
      notifyUser(result.rows[0].restaurante_id, 'CONVERSATION_CLOSED', {
        conversacion_id: conversacion_id
      });
    }

    res.json({ message: 'Conversación cerrada exitosamente' });
  } catch (error) {
    console.error('Error in closeConversation:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getDashboardAdmin = async (req, res) => {
  try {
    const query = `
      SELECT 
        COUNT(*) as total_tickets,
        COUNT(CASE WHEN estado = 'cerrada' THEN 1 END) as tickets_cerrados,
        COUNT(CASE WHEN estado = 'pendiente' THEN 1 END) as tickets_pendientes,
        COUNT(CASE WHEN estado = 'en_atencion' THEN 1 END) as tickets_activos,
        AVG(CASE WHEN estado = 'cerrada' THEN EXTRACT(EPOCH FROM (fecha_cierre - fecha_creacion)) END) as avg_resolution_time_seconds,
        AVG(calificacion) as avg_rating,
        COUNT(calificacion) as total_ratings
      FROM soporte_conversaciones
    `;
    
    const statsByAgentQuery = `
      SELECT 
        admin_id,
        r.nombre_dueno as nombre_agente,
        COUNT(*) as tickets_atendidos,
        COUNT(CASE WHEN c.estado = 'cerrada' THEN 1 END) as cerrados,
        AVG(calificacion) as avg_rating,
        COUNT(calificacion) as calificaciones
      FROM soporte_conversaciones c
      JOIN restaurantes r ON c.admin_id = r.id
      WHERE admin_id IS NOT NULL
      GROUP BY admin_id, r.nombre_dueno
    `;

    const [globalStats, agentStats] = await Promise.all([
      db.query(query),
      db.query(statsByAgentQuery)
    ]);

    const global = globalStats.rows[0];
    res.json({
      avgRating: parseFloat(global.avg_rating || 0),
      ticketsClosed: parseInt(global.tickets_cerrados || 0),
      avgTime: global.avg_resolution_time_seconds ? (global.avg_resolution_time_seconds / 60).toFixed(1) + ' min' : 'N/A',
      pendingTickets: parseInt(global.tickets_pendientes || 0),
      activeTickets: parseInt(global.tickets_activos || 0),
      por_agente: agentStats.rows
    });
  } catch (error) {
    console.error('Error in getDashboardAdmin:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  streamConversations,
  getMisConversaciones,
  sendMessageRestaurante,
  rateConversacion,
  getConversationsAdmin,
  getConversationMessagesAdmin,
  aceptarConversacion,
  sendMessageAdmin,
  closeConversation,
  getDashboardAdmin
};
