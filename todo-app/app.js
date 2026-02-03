// 待办事项小程序示例
App({
  data: {
    todos: [],
    newTodo: '',
    filter: 'all' // all, active, completed
  },
  
  onLaunch() {
    console.log('待办事项小程序启动');
    // 从本地存储加载数据
    this.loadTodos();
  },
  
  onUpdate(opts) {
    console.log('待办事项数据更新', opts);
  },

  // 添加待办事项
  addTodo() {
    if (this.data.newTodo.trim()) {
      const newTodo = {
        id: Date.now(),
        text: this.data.newTodo.trim(),
        completed: false,
        createdAt: new Date().toISOString()
      };
      
      const todos = [...this.data.todos, newTodo];
      setData({ 
        data: { 
          todos: todos,
          newTodo: ''
        } 
      });
      
      this.saveTodos(todos);
    }
  },

  // 删除待办事项
  removeTodo(id) {
    const todos = this.data.todos.filter(todo => todo.id !== id);
    setData({ data: { todos } });
    this.saveTodos(todos);
  },

  // 切换完成状态
  toggleTodo(id) {
    const todos = this.data.todos.map(todo => 
      todo.id === id ? { ...todo, completed: !todo.completed } : todo
    );
    setData({ data: { todos } });
    this.saveTodos(todos);
  },

  // 清除已完成的事项
  clearCompleted() {
    const todos = this.data.todos.filter(todo => !todo.completed);
    setData({ data: { todos } });
    this.saveTodos(todos);
  },

  // 设置过滤器
  setFilter(filter) {
    setData({ data: { filter } });
  },

  // 更新输入框内容
  updateNewTodo(text) {
    setData({ data: { newTodo: text } });
  },

  // 获取过滤后的待办事项
  getFilteredTodos() {
    switch (this.data.filter) {
      case 'active':
        return this.data.todos.filter(todo => !todo.completed);
      case 'completed':
        return this.data.todos.filter(todo => todo.completed);
      default:
        return this.data.todos;
    }
  },

  // 保存到本地存储
  saveTodos(todos) {
    try {
      localStorage.setItem('miniapp_todos', JSON.stringify(todos));
    } catch (error) {
      console.error('保存待办事项失败:', error);
    }
  },

  // 从本地存储加载
  loadTodos() {
    try {
      const saved = localStorage.getItem('miniapp_todos');
      if (saved) {
        const todos = JSON.parse(saved);
        setData({ data: { todos } });
      }
    } catch (error) {
      console.error('加载待办事项失败:', error);
    }
  }
});