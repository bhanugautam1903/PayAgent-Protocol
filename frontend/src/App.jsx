import { useEffect, useState } from "react";
import api from "./services/api";
import "./App.css";

const formatStatus = (value) =>
  String(value || "unknown").replaceAll("_", " ");

const money = (value) => `$${Number(value || 0).toFixed(2)}`;

function App() {
  const [serverStatus, setServerStatus] = useState("Checking...");
  const [error, setError] = useState("");
  const [paymentMessage, setPaymentMessage] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [agents, setAgents] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [creating, setCreating] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [busyTask, setBusyTask] = useState("");
  const [csvFiles, setCsvFiles] = useState({});
  const [reviewInputs, setReviewInputs] = useState({});
  const [expandedTasks, setExpandedTasks] = useState({});
  const [taskFilter, setTaskFilter] = useState("all");

  const [form, setForm] = useState({
    requesterAgentId: "",
    assignedAgentId: "",
    title: "",
    description: "",
    requiredCapability: "",
    budget: "",
  });

  const loadDashboard = async () => {
    const [agentResponse, taskResponse] = await Promise.all([
      api.get("/agents"),
      api.get("/tasks"),
    ]);

    setAgents(agentResponse.data.agents || []);
    setTasks(taskResponse.data.tasks || []);
  };

  const refreshDashboard = async () => {
    setRefreshing(true);
    setError("");
    try {
      await loadDashboard();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Could not refresh dashboard."
      );
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    const initialize = async () => {
      try {
        const response = await api.get("/health");
        setServerStatus(response.data.status);
      } catch {
        setServerStatus("Offline");
        setError("Backend connection failed.");
      }

      try {
        const params = new URLSearchParams(window.location.search);
        const orderId = params.get("token");

        if (orderId) {
          setVerifying(true);
          setPaymentMessage("Verifying PayPal approval...");

          const response = await api.post(
            "/tasks/confirm-payment",
            { orderId }
          );

          setPaymentMessage(
            response.data.success
              ? "PayPal approval verified. Payment will be captured after requester approval."
              : "PayPal approval could not be verified."
          );
        }

        await loadDashboard();
      } catch (err) {
        setError(
          err.response?.data?.message ||
            "Could not load dashboard data."
        );
      } finally {
        setVerifying(false);
        if (window.location.search) {
          window.history.replaceState(
            {},
            document.title,
            window.location.pathname
          );
        }
      }
    };

    initialize();
  }, []);

  const handleChange = (event) => {
    setForm((previous) => ({
      ...previous,
      [event.target.name]: event.target.value,
    }));
  };

  const createTask = async (event) => {
    event.preventDefault();
    setCreating(true);
    setError("");
    setPaymentMessage("");

    try {
      const response = await api.post("/tasks/create", {
        ...form,
        budget: Number(form.budget),
      });

      if (response.data.approvalUrl) {
        window.location.href = response.data.approvalUrl;
        return;
      }

      setError("PayPal approval link was not returned.");
    } catch (err) {
      setError(
        err.response?.data?.message || "Task creation failed."
      );
    } finally {
      setCreating(false);
    }
  };

  const acceptTask = async (task) => {
    setBusyTask(task.taskId);
    setError("");

    try {
      const response = await api.post("/tasks/accept", {
        taskId: task.taskId,
        agentId: task.assignedAgentId,
      });

      setPaymentMessage(response.data.message);
      await loadDashboard();
    } catch (err) {
      setError(
        err.response?.data?.message || "Could not accept task."
      );
    } finally {
      setBusyTask("");
    }
  };

  const executeTask = async (task) => {
    const file = csvFiles[task.taskId];

    if (!file) {
      setError("Please select a CSV file first.");
      return;
    }

    if (!file.name.toLowerCase().endsWith(".csv")) {
      setError("Only CSV files are allowed.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("CSV file must not exceed 5 MB.");
      return;
    }

    setBusyTask(task.taskId);
    setError("");
    setPaymentMessage("");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const analysisResponse = await api.post(
        "/tasks/analyze-sales",
        formData
      );

      if (!analysisResponse.data.success) {
        throw new Error("Sales analysis failed.");
      }

      const report = analysisResponse.data.analysis.report;

      if (!report) {
        throw new Error(
          "The sales analysis report was not generated."
        );
      }

      const executionResponse = await api.post(
        "/tasks/execute",
        {
          taskId: task.taskId,
          agentId: task.assignedAgentId,
          result: report,
        }
      );

      setPaymentMessage(
        executionResponse.data.message ||
          "Sales analysis submitted for AI verification."
      );

      setCsvFiles((previous) => ({
        ...previous,
        [task.taskId]: null,
      }));

      await loadDashboard();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Task execution failed."
      );
    } finally {
      setBusyTask("");
    }
  };

  const reviewTask = async (task, decision) => {
    setBusyTask(task.taskId);
    setError("");
    setPaymentMessage("");

    try {
      const response = await api.post("/tasks/review", {
        taskId: task.taskId,
        requesterAgentId: task.requesterAgentId,
        decision,
        feedback: reviewInputs[task.taskId] || "",
      });

      setPaymentMessage(response.data.message);
      await loadDashboard();
    } catch (err) {
      setError(
        err.response?.data?.message || "Task review failed."
      );
    } finally {
      setBusyTask("");
    }
  };

  const agentName = (agentId) =>
    agents.find((agent) => agent.agentId === agentId)?.name ||
    "Unknown Agent";

  const pendingCount = tasks.filter(
    (task) => task.status === "pending"
  ).length;

  const capturedCount = tasks.filter(
    (task) => task.paymentStatus === "captured"
  ).length;

  const visibleTasks = tasks.filter(
    (task) =>
      taskFilter === "all" || task.status === taskFilter
  );

  const toggleTask = (taskId) => {
    setExpandedTasks((previous) => ({
      ...previous,
      [taskId]: !previous[taskId],
    }));
  };

  const filters = [
    "all",
    "pending",
    "accepted",
    "under_review",
    "approved",
    "rejected",
  ];

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <div className="brand-icon">P</div>
          <div>
            <h2>PayAgent Protocol</h2>
            <span>Agent Commerce Infrastructure</span>
          </div>
        </div>

        <div className="header-right">
          <span className="sandbox-tag">PAYPAL SANDBOX</span>
          <div className="connection">
            <span
              className={`status-dot ${
                serverStatus === "healthy" ? "online" : ""
              }`}
            />
            Backend: {serverStatus}
          </div>
        </div>
      </header>

      <main className="dashboard">
        <section className="welcome">
          <div className="hero-content">
            <p className="eyebrow">THE AGENT PAYMENT NETWORK</p>
            <h1>
              Commerce for the
              <br />
              <span className="gradient-text">agent economy.</span>
            </h1>
            <p className="hero-description">
              Delegate tasks, verify results, and release payments
              through one intelligent agent-to-agent workflow.
            </p>

            <div className="hero-chips">
              <span>◇ Agent Orchestration</span>
              <span>✧ Gemini Verification</span>
              <span>◉ PayPal Sandbox</span>
            </div>
          </div>

          <div className="hero-visual" aria-hidden="true">
            <div className="orbit orbit-one" />
            <div className="orbit orbit-two" />
            <div className="hero-symbol">P</div>
            <span className="orbit-dot dot-one" />
            <span className="orbit-dot dot-two" />
          </div>
        </section>

        {error && (
          <div className="alert error" role="alert">
            {error}
          </div>
        )}

        {verifying && (
          <div className="alert">
            Verifying PayPal approval...
          </div>
        )}

        {paymentMessage && (
          <div className="alert success" role="status">
            {paymentMessage}
          </div>
        )}

        <section className="stats">
          <div className="stat-card">
            <div className="stat-top">
              <span>Total Agents</span>
              <span className="stat-icon">◇</span>
            </div>
            <h2>{agents.length}</h2>
            <small>Registered network agents</small>
          </div>

          <div className="stat-card">
            <div className="stat-top">
              <span>Total Tasks</span>
              <span className="stat-icon">▤</span>
            </div>
            <h2>{tasks.length}</h2>
            <small>Recorded transactions</small>
          </div>

          <div className="stat-card">
            <div className="stat-top">
              <span>Pending Tasks</span>
              <span className="stat-icon">◷</span>
            </div>
            <h2>{pendingCount}</h2>
            <small>Awaiting next action</small>
          </div>

          <div className="stat-card">
            <div className="stat-top">
              <span>Captured Payments</span>
              <span className="stat-icon">↗</span>
            </div>
            <h2>{capturedCount}</h2>
            <small>Sandbox captures recorded</small>
          </div>
        </section>

        <section className="lifecycle">
          <div className="section-heading">
            <div>
              <p className="eyebrow">TRANSACTION LIFECYCLE</p>
              <h2>From delegation to payment</h2>
            </div>
            <span className="subtle-tag">
              Requester-controlled release
            </span>
          </div>

          <div className="lifecycle-steps">
            {[
              ["01", "Create Task", "Delegate work"],
              ["02", "Approve Payment", "PayPal Sandbox"],
              ["03", "Execute & Verify", "CSV + Gemini"],
              ["04", "Capture Payment", "Requester approval"],
            ].map(([number, title, description]) => (
              <div className="lifecycle-step" key={number}>
                <span className="step-number">{number}</span>
                <div>
                  <strong>{title}</strong>
                  <small>{description}</small>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="content-grid">
          <div className="panel create-panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">NEW TRANSACTION</p>
                <h2>Create a Task</h2>
                <p>Delegate work to a registered agent.</p>
              </div>
              <span className="panel-icon">✦</span>
            </div>

            <form onSubmit={createTask}>
              <div className="form-grid">
                <div className="form-field">
                  <label htmlFor="requester">
                    Requester Agent
                  </label>
                  <select
                    id="requester"
                    name="requesterAgentId"
                    value={form.requesterAgentId}
                    onChange={handleChange}
                    required
                  >
                    <option value="">
                      Select requester agent
                    </option>
                    {agents.map((agent) => (
                      <option
                        key={agent.agentId}
                        value={agent.agentId}
                      >
                        {agent.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-field">
                  <label htmlFor="assigned">
                    Assigned Agent
                  </label>
                  <select
                    id="assigned"
                    name="assignedAgentId"
                    value={form.assignedAgentId}
                    onChange={handleChange}
                    required
                  >
                    <option value="">
                      Select assigned agent
                    </option>
                    {agents.map((agent) => (
                      <option
                        key={agent.agentId}
                        value={agent.agentId}
                      >
                        {agent.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <label htmlFor="task-title">Task Title</label>
              <input
                id="task-title"
                name="title"
                value={form.title}
                onChange={handleChange}
                placeholder="e.g. Analyze Sales Dataset"
                required
              />

              <label htmlFor="task-description">
                Description
              </label>
              <textarea
                id="task-description"
                name="description"
                value={form.description}
                onChange={handleChange}
                placeholder="Describe the work to be completed..."
                required
              />

              <div className="form-grid">
                <div className="form-field">
                  <label htmlFor="capability">
                    Required Capability
                  </label>
                  <input
                    id="capability"
                    name="requiredCapability"
                    value={form.requiredCapability}
                    onChange={handleChange}
                    placeholder="e.g. data-analysis"
                    required
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="budget">
                    Budget (USD)
                  </label>
                  <input
                    id="budget"
                    type="number"
                    name="budget"
                    value={form.budget}
                    onChange={handleChange}
                    placeholder="e.g. 1.00"
                    min="0.01"
                    step="0.01"
                    required
                  />
                </div>
              </div>

              <button
                className="primary-button"
                type="submit"
                disabled={creating}
              >
                {creating
                  ? "Creating Task..."
                  : "Create Task & Continue to PayPal →"}
              </button>
              <p className="form-note">
                Payments use PayPal Sandbox test accounts.
              </p>
            </form>
          </div>

          <div className="panel network-panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">NETWORK OVERVIEW</p>
                <h2>Registered Agents</h2>
                <p>Available participants in the network.</p>
              </div>
              <span className="panel-icon">◇</span>
            </div>

            <div className="agent-list">
              {agents.length === 0 ? (
                <p className="empty">No agents found.</p>
              ) : (
                agents.map((agent) => (
                  <div
                    className="agent-row"
                    key={agent.agentId}
                  >
                    <div className="agent-avatar">
                      {agent.name?.slice(0, 1)?.toUpperCase() ||
                        "A"}
                    </div>
                    <div className="agent-info">
                      <strong>{agent.name}</strong>
                      <small>
                        {agent.status || "Registered"}
                      </small>
                    </div>
                    <span
                      className={`agent-state ${
                        agent.status === "active"
                          ? "is-active"
                          : ""
                      }`}
                    >
                      ● {agent.status || "Registered"}
                    </span>
                  </div>
                ))
              )}
            </div>

            <div className="divider" />

            <div className="panel-heading">
              <div>
                <p className="eyebrow">RECENT ACTIVITY</p>
                <h2>Latest Tasks</h2>
              </div>
              <button
                className="secondary-button"
                type="button"
                onClick={refreshDashboard}
                disabled={refreshing}
              >
                {refreshing ? "Refreshing..." : "↻ Refresh"}
              </button>
            </div>

            <div className="recent-list">
              {tasks.length === 0 ? (
                <p className="empty">
                  No tasks available yet.
                </p>
              ) : (
                tasks.slice(0, 6).map((task) => (
                  <div
                    className="task-row"
                    key={task.taskId}
                  >
                    <div className="recent-task-info">
                      <strong>
                        {task.title || "Untitled Task"}
                      </strong>
                      <span
                        className={`status-pill status-${
                          task.status || "unknown"
                        }`}
                      >
                        {formatStatus(task.status)}
                      </span>
                    </div>
                    <span className="task-budget">
                      {money(task.budget)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

        <section className="workflow-panel">
          <div className="panel-heading workflow-heading">
            <div>
              <p className="eyebrow">TASK MANAGEMENT</p>
              <h2>Agent Task Workflow</h2>
              <p>
                Track execution, verification, and payments.
              </p>
            </div>

            <button
              className="secondary-button"
              type="button"
              onClick={refreshDashboard}
              disabled={refreshing}
            >
              {refreshing
                ? "Refreshing..."
                : "↻ Refresh Tasks"}
            </button>
          </div>

          <div className="workflow-toolbar">
            <div
              className="filter-tabs"
              role="group"
              aria-label="Filter tasks"
            >
              {filters.map((filter) => (
                <button
                  key={filter}
                  type="button"
                  className={`filter-tab ${
                    taskFilter === filter ? "selected" : ""
                  }`}
                  onClick={() => setTaskFilter(filter)}
                >
                  {filter === "all"
                    ? "All Tasks"
                    : formatStatus(filter)}
                </button>
              ))}
            </div>
            <span className="result-count">
              {visibleTasks.length} tasks
            </span>
          </div>

          <div className="workflow-list">
            {visibleTasks.length === 0 && (
              <p className="empty">
                No tasks match this filter.
              </p>
            )}

            {visibleTasks.map((task) => {
              const isExpanded =
                !!expandedTasks[task.taskId] ||
                task.status === "accepted" ||
                task.status === "under_review";

              const isBusy = busyTask === task.taskId;

              return (
                <article
                  className={`workflow-card ${
                    isExpanded ? "expanded" : ""
                  }`}
                  key={task.taskId}
                >
                  <button
                    className="task-card-header"
                    type="button"
                    onClick={() => toggleTask(task.taskId)}
                    aria-expanded={isExpanded}
                  >
                    <span className="task-card-main">
                      <span className="task-card-symbol">
                        ◇
                      </span>
                      <span className="task-card-title">
                        <strong>
                          {task.title || "Untitled Task"}
                        </strong>
                        <small>
                          {agentName(task.requesterAgentId)}
                          {" → "}
                          {agentName(task.assignedAgentId)}
                        </small>
                      </span>
                    </span>

                    <span className="task-card-meta">
                      <span
                        className={`status-pill status-${
                          task.status || "unknown"
                        }`}
                      >
                        {formatStatus(task.status)}
                      </span>
                      <span
                        className={`status-pill payment-${
                          task.paymentStatus || "unknown"
                        }`}
                      >
                        {formatStatus(task.paymentStatus)}
                      </span>
                      <strong>{money(task.budget)}</strong>
                      <span className="chevron">
                        {isExpanded ? "⌃" : "⌄"}
                      </span>
                    </span>
                  </button>

                  {isExpanded && (
                    <div className="task-card-body">
                      <div className="task-description">
                        {task.description ||
                          "No task description provided."}
                      </div>

                      <div className="task-facts">
                        <div>
                          <span>Task ID</span>
                          <strong>{task.taskId}</strong>
                        </div>
                        <div>
                          <span>Required Capability</span>
                          <strong>
                            {task.requiredCapability}
                          </strong>
                        </div>
                        <div>
                          <span>Task Status</span>
                          <strong>
                            {formatStatus(task.status)}
                          </strong>
                        </div>
                        <div>
                          <span>Payment Status</span>
                          <strong>
                            {formatStatus(
                              task.paymentStatus
                            )}
                          </strong>
                        </div>
                      </div>

                      {task.status === "pending" && (
                        <div className="task-action-area">
                          {task.paymentStatus ===
                          "approved" ? (
                            <>
                              <p className="notice info">
                                PayPal approval confirmed.
                                The assigned agent can accept
                                this task.
                              </p>
                              <button
                                className="action-button blue"
                                type="button"
                                disabled={isBusy}
                                onClick={() =>
                                  acceptTask(task)
                                }
                              >
                                {isBusy
                                  ? "Accepting..."
                                  : "Accept Task"}
                              </button>
                            </>
                          ) : (
                            <p className="notice warning">
                              PayPal approval is required
                              before agent acceptance.
                            </p>
                          )}
                        </div>
                      )}

                      {task.status === "accepted" && (
                        <div className="task-action-area">
                          <p className="notice info">
                            Task accepted. Upload a sales
                            CSV to generate an analysis
                            report.
                          </p>

                          <label
                            className="upload-label"
                            htmlFor={`csv-${task.taskId}`}
                          >
                            Sales Dataset (CSV)
                          </label>

                          <input
                            id={`csv-${task.taskId}`}
                            className="file-input"
                            type="file"
                            accept=".csv,text/csv"
                            onChange={(event) =>
                              setCsvFiles((previous) => ({
                                ...previous,
                                [task.taskId]:
                                  event.target.files?.[0] ||
                                  null,
                              }))
                            }
                          />

                          <p className="helper-text">
                            Maximum 5 MB. Required columns:
                            date, product, quantity,
                            unitPrice.
                          </p>

                          {csvFiles[task.taskId] && (
                            <p className="selected-file">
                              ✓ Selected:{" "}
                              {csvFiles[task.taskId].name}
                            </p>
                          )}

                          <button
                            className="action-button blue"
                            type="button"
                            disabled={
                              isBusy ||
                              !csvFiles[task.taskId]
                            }
                            onClick={() =>
                              executeTask(task)
                            }
                          >
                            {isBusy
                              ? "Analyzing & Submitting..."
                              : "Analyze CSV & Submit Result"}
                          </button>
                        </div>
                      )}

                      {task.status === "under_review" && (
                        <div className="task-action-area">
                          <p className="notice warning">
                            Submitted result is awaiting
                            requester review.
                          </p>

                          <h3>Execution Result</h3>
                          <div className="report-box">
                            {task.executionResult ||
                              "No result submitted."}
                          </div>

                          {task.aiVerification && (
                            <div className="ai-panel">
                              <div className="ai-panel-heading">
                                <h3>
                                  ✧ Gemini AI Verification
                                </h3>
                                <span
                                  className={`status-pill status-${
                                    task.aiVerification
                                      .verdict || "unknown"
                                  }`}
                                >
                                  {formatStatus(
                                    task.aiVerification
                                      .verdict
                                  )}
                                </span>
                              </div>

                              <div className="ai-metrics">
                                <div>
                                  <span>Evaluation Score</span>
                                  <strong>
                                    {task.aiVerification
                                      .score ?? "N/A"}
                                    /100
                                  </strong>
                                </div>
                                <div>
                                  <span>Availability</span>
                                  <strong>
                                    {task.aiVerification
                                      .verificationAvailable
                                      ? "Available"
                                      : "Manual Review"}
                                  </strong>
                                </div>
                              </div>

                              <p>
                                {task.aiVerification
                                  .reasoning ||
                                  task.aiVerification
                                    .reason ||
                                  "No reasoning provided."}
                              </p>

                              {task.aiVerification
                                .missingItems?.length > 0 && (
                                <p className="helper-text">
                                  Missing:{" "}
                                  {task.aiVerification
                                    .missingItems.join(", ")}
                                </p>
                              )}
                            </div>
                          )}

                          <label
                            className="upload-label"
                            htmlFor={`review-${task.taskId}`}
                          >
                            Review Feedback
                          </label>

                          <textarea
                            id={`review-${task.taskId}`}
                            className="review-textarea"
                            rows={3}
                            placeholder="Enter review feedback..."
                            value={
                              reviewInputs[task.taskId] ||
                              ""
                            }
                            onChange={(event) =>
                              setReviewInputs(
                                (previous) => ({
                                  ...previous,
                                  [task.taskId]:
                                    event.target.value,
                                })
                              )
                            }
                          />

                          <div className="review-actions">
                            <button
                              className="action-button green"
                              type="button"
                              disabled={isBusy}
                              onClick={() =>
                                reviewTask(
                                  task,
                                  "approved"
                                )
                              }
                            >
                              {isBusy
                                ? "Processing..."
                                : "Approve & Capture Payment"}
                            </button>

                            <button
                              className="action-button red"
                              type="button"
                              disabled={isBusy}
                              onClick={() =>
                                reviewTask(
                                  task,
                                  "rejected"
                                )
                              }
                            >
                              Reject Task
                            </button>
                          </div>
                        </div>
                      )}

                      {task.status === "approved" && (
                        <div className="task-action-area">
                          {task.paymentStatus ===
                          "captured" ? (
                            <p className="notice success">
                              ✓ Task approved and payment
                              captured successfully.
                            </p>
                          ) : (
                            <p className="notice warning">
                              Task approved, but no captured
                              payment is recorded for this
                              task.
                            </p>
                          )}

                          {task.paypalCaptureId && (
                            <p className="helper-text">
                              PayPal Capture ID:{" "}
                              {task.paypalCaptureId}
                            </p>
                          )}
                        </div>
                      )}

                      {task.status === "rejected" && (
                        <div className="task-action-area">
                          <p className="notice danger">
                            Task rejected. Payment was not
                            captured.
                          </p>
                          {task.reviewFeedback && (
                            <p className="helper-text">
                              Feedback:{" "}
                              {task.reviewFeedback}
                            </p>
                          )}
                        </div>
                      )}

                      {task.status === "completed" && (
                        <p className="notice info">
                          Execution completed. Payment
                          status:{" "}
                          {formatStatus(
                            task.paymentStatus
                          )}
                          .
                        </p>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </section>

        <footer>
          <strong>PayAgent Protocol</strong>
          <span>
            Autonomous Agent-to-Agent Micro-Commerce
            · PayPal Sandbox Demonstration
          </span>
        </footer>
      </main>
    </div>
  );
}

export default App;
